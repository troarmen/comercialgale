"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
 * FundoLiquido — fluido pixelizado nos tons da marca.
 *
 * Simulação de fluido (Navier-Stokes simplificado) em WebGL, pintada em blocos
 * com dithering Bayer: o vermelho da Galé "escorre" atrás do banner e reage ao
 * cursor; quando ninguém mexe, um piloto automático mantém um movimento lento.
 *
 * Regras de casa:
 *  - É DECORAÇÃO. O contêiner é aria-hidden e não captura clique; o mouse chega
 *    por um ouvinte na janela, então links e botões por cima continuam vivos.
 *  - Nunca é renderizado no servidor e só entra pelo `FundoLiquidoLazy`, que
 *    decide se o aparelho merece a conta (ponteiro fino, sem reduced-motion,
 *    sem save-data) e carrega este arquivo — e o three.js — depois do idle.
 *  - Para quando sai da tela (IntersectionObserver) e quando a aba se esconde.
 *  - A loja é sempre clara: não há paleta escura nem observador de tema.
 */

const face_vert = /* glsl */ `
attribute vec3 position;
uniform vec2 px;
uniform vec2 boundarySpace;
varying vec2 uv;
precision highp float;
void main(){
  vec3 pos = position;
  vec2 scale = 1.0 - boundarySpace * 2.0;
  pos.xy = pos.xy * scale;
  uv = vec2(0.5) + pos.xy * 0.5;
  gl_Position = vec4(pos, 1.0);
}
`;

const mouse_vert = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
  vec2 pos = position.xy * scale * 2.0 * px + center;
  vUv = uv;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const advection_frag = /* glsl */ `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform bool isBFECC;
uniform vec2 fboSize;
uniform vec2 px;
varying vec2 uv;
void main(){
  vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
  if(isBFECC == false){
    vec2 vel = texture2D(velocity, uv).xy;
    vec2 uv2 = uv - vel * dt * ratio;
    vec2 newVel = texture2D(velocity, uv2).xy;
    gl_FragColor = vec4(newVel, 0.0, 0.0);
  } else {
    vec2 spot_new = uv;
    vec2 vel_old = texture2D(velocity, uv).xy;
    vec2 spot_old = spot_new - vel_old * dt * ratio;
    vec2 vel_new1 = texture2D(velocity, spot_old).xy;
    vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
    vec2 error = spot_new2 - spot_new;
    vec2 spot_new3 = spot_new - error / 2.0;
    vec2 vel_2 = texture2D(velocity, spot_new3).xy;
    vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
    vec2 newVel2 = texture2D(velocity, spot_old2).xy;
    gl_FragColor = vec4(newVel2, 0.0, 0.0);
  }
}
`;

const color_frag = /* glsl */ `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D palette;
uniform sampler2D uBayer;
uniform vec4 bgColor;
uniform float uTime;
uniform vec2 uRes;
uniform float uPixelSize;
uniform float uGrain;

varying vec2 uv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main(){
  vec2 pixGrid = uRes / uPixelSize;
  vec2 pixUV   = (floor(uv * pixGrid) + 0.5) / pixGrid;

  vec2 vel  = texture2D(velocity, pixUV).xy;
  float len = clamp(length(vel) * 1.7, 0.0, 1.0);

  vec2 bayerUV = (mod(floor(gl_FragCoord.xy), 4.0) + 0.5) / 4.0;
  float dither  = texture2D(uBayer, bayerUV).r - 0.5;

  float noiseVal = noise(uv * 6.0 + uTime * 0.15) * 0.06 - 0.03;

  float t = clamp(len + dither * 0.12 + noiseVal, 0.0, 1.0);

  vec3 fluidColor = texture2D(palette, vec2(t, 0.5)).rgb;
  vec3 col        = mix(bgColor.rgb, fluidColor, t);

  float grain = hash(gl_FragCoord.xy + vec2(uTime * 137.0, uTime * 91.0));
  col += (grain - 0.5) * uGrain;

  float alpha = mix(bgColor.a, 1.0, t);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}
`;

const divergence_frag = /* glsl */ `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform vec2 px;
varying vec2 uv;
void main(){
  float x0 = texture2D(velocity, uv - vec2(px.x, 0.0)).x;
  float x1 = texture2D(velocity, uv + vec2(px.x, 0.0)).x;
  float y0 = texture2D(velocity, uv - vec2(0.0, px.y)).y;
  float y1 = texture2D(velocity, uv + vec2(0.0, px.y)).y;
  float divergence = (x1 - x0 + y1 - y0) / 2.0;
  gl_FragColor = vec4(divergence / dt);
}
`;

const externalForce_frag = /* glsl */ `
precision highp float;
uniform vec2 force;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
  vec2 circle = (vUv - 0.5) * 2.0;
  float d = 1.0 - min(length(circle), 1.0);
  d *= d;
  gl_FragColor = vec4(force * d, 0.0, 1.0);
}
`;

const poisson_frag = /* glsl */ `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform vec2 px;
varying vec2 uv;
void main(){
  float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
  float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
  float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
  float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
  float div = texture2D(divergence, uv).r;
  float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
  gl_FragColor = vec4(newP);
}
`;

const pressure_frag = /* glsl */ `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
  float p0 = texture2D(pressure, uv + vec2(px.x, 0.0)).r;
  float p1 = texture2D(pressure, uv - vec2(px.x, 0.0)).r;
  float p2 = texture2D(pressure, uv + vec2(0.0, px.y)).r;
  float p3 = texture2D(pressure, uv - vec2(0.0, px.y)).r;
  vec2 v      = texture2D(velocity, uv).xy;
  vec2 gradP  = vec2(p0 - p1, p2 - p3) * 0.5;
  v = v - gradP * dt;
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

type Uniforms = Record<string, { value: unknown }>;

/*
 * Paleta da Galé, do gelo ao coração: a velocidade do fluido percorre esta
 * rampa. O topo (gale-500) só aparece nos picos — o grosso do tempo o que se
 * vê é rosa-gelo e gale-300, que convive com o texto carvão do banner.
 */
const PALETA_GALE = ["#ffffff", "#fde3e5", "#fbccd1", "#f7a5ad", "#f27484", "#e63946"];

function makePaletteTexture(stops: string[]): THREE.DataTexture {
  const arr = stops.length === 1 ? [stops[0], stops[0]] : stops;
  const data = new Uint8Array(arr.length * 4);
  for (let i = 0; i < arr.length; i++) {
    const c = new THREE.Color(arr[i]);
    data[i * 4] = Math.round(c.r * 255);
    data[i * 4 + 1] = Math.round(c.g * 255);
    data[i * 4 + 2] = Math.round(c.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, arr.length, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function makeBayerTexture(): THREE.DataTexture {
  const raw = [
    0, 136, 34, 170, 204, 68, 238, 102, 51, 187, 17, 153, 255, 119, 221, 85,
  ];
  const data = new Uint8Array(16 * 4);
  for (let i = 0; i < 16; i++) {
    data[i * 4] = raw[i];
    data[i * 4 + 1] = raw[i];
    data[i * 4 + 2] = raw[i];
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

class CommonGL {
  width = 1;
  height = 1;
  renderer: THREE.WebGLRenderer | null = null;
  clock: THREE.Clock | null = null;
  time = 0;
  delta = 0;
  container: HTMLElement | null = null;

  init(container: HTMLElement) {
    this.container = container;
    this.resize();
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.width, this.height, false);
    const el = this.renderer.domElement;
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";
    this.clock = new THREE.Clock();
    this.clock.start();
  }

  resize() {
    if (!this.container) return;
    const r = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(r.width));
    this.height = Math.max(1, Math.floor(r.height));
    this.renderer?.setSize(this.width, this.height, false);
  }

  update() {
    if (!this.clock) return;
    this.delta = this.clock.getDelta();
    this.time += this.delta;
  }
}

class MouseGL {
  coords = new THREE.Vector2();
  coords_old = new THREE.Vector2();
  diff = new THREE.Vector2();
  isAutoActive = false;
  autoIntensity = 2.0;
  container: HTMLElement | null = null;
  onInteract: (() => void) | null = null;

  private _move = this._onMove.bind(this);

  init(container: HTMLElement) {
    this.container = container;
    window.addEventListener("mousemove", this._move, { passive: true });
  }

  dispose() {
    window.removeEventListener("mousemove", this._move);
  }

  private _onMove(e: MouseEvent) {
    if (!this.container) return;
    const r = this.container.getBoundingClientRect();
    const dentro =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!dentro) return;
    this.onInteract?.();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
  }

  setNormalized(x: number, y: number) {
    this.coords.set(x, y);
  }

  update() {
    this.diff.subVectors(this.coords, this.coords_old);
    this.coords_old.copy(this.coords);
    if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
    if (this.isAutoActive) this.diff.multiplyScalar(this.autoIntensity);
  }
}

class ShaderPass {
  scene: THREE.Scene;
  camera: THREE.Camera;
  material: THREE.RawShaderMaterial;
  geometry: THREE.BufferGeometry;
  uniforms: Uniforms;
  output: THREE.WebGLRenderTarget | null;
  renderer: () => THREE.WebGLRenderer | null;

  constructor(
    renderer: () => THREE.WebGLRenderer | null,
    vertShader: string,
    fragShader: string,
    uniforms: Uniforms,
    output: THREE.WebGLRenderTarget | null = null,
  ) {
    this.renderer = renderer;
    this.uniforms = uniforms;
    this.output = output;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.material = new THREE.RawShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  render(to: THREE.WebGLRenderTarget | null = this.output) {
    const r = this.renderer();
    if (!r) return;
    r.setRenderTarget(to);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
  }

  dispose() {
    this.material.dispose();
    this.geometry.dispose();
  }
}

/** Piloto automático: passeia devagar pelo quadro e cede ao cursor. */
class AutoDriver {
  speed: number;
  resumeDelay: number;
  current = new THREE.Vector2();
  target = new THREE.Vector2();
  lastTime = performance.now();
  private _tmp = new THREE.Vector2();
  private _mouse: MouseGL;
  private _getLastInteraction: () => number;

  constructor(
    mouse: MouseGL,
    getLastInteraction: () => number,
    speed = 0.4,
    resumeDelay = 1200,
  ) {
    this._mouse = mouse;
    this._getLastInteraction = getLastInteraction;
    this.speed = speed;
    this.resumeDelay = resumeDelay;
    this._pickTarget();
  }

  private _pickTarget() {
    this.target.set(
      (Math.random() * 2 - 1) * 0.8,
      (Math.random() * 2 - 1) * 0.8,
    );
  }

  update() {
    const now = performance.now();
    const idleMs = now - this._getLastInteraction();
    if (idleMs < this.resumeDelay) {
      this._mouse.isAutoActive = false;
      this.lastTime = now;
      return;
    }
    this._mouse.isAutoActive = true;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const dir = this._tmp.subVectors(this.target, this.current);
    const dist = dir.length();
    if (dist < 0.02) {
      this._pickTarget();
      return;
    }
    dir.normalize();
    this.current.addScaledVector(dir, Math.min(this.speed * dt, dist));
    this._mouse.setNormalized(this.current.x, this.current.y);
  }
}

interface SimOpts {
  resolution: number;
  mouse_force: number;
  cursor_size: number;
  dt: number;
  iterations_poisson: number;
}

class FluidSim {
  opts: SimOpts;
  fboSize = new THREE.Vector2();
  cellScale = new THREE.Vector2();
  fbos: Record<string, THREE.WebGLRenderTarget> = {};
  gl: CommonGL;
  mouse: MouseGL;

  advection!: ShaderPass;
  externalForce!: { scene: THREE.Scene; camera: THREE.Camera; mesh: THREE.Mesh };
  divergencePass!: ShaderPass;
  poissonPass!: ShaderPass;
  pressurePass!: ShaderPass;

  constructor(gl: CommonGL, mouse: MouseGL, opts: SimOpts) {
    this.gl = gl;
    this.mouse = mouse;
    this.opts = opts;
    this._calcSize();
    this._createFBOs();
    this._createPasses();
  }

  private _r = () => this.gl.renderer;

  private _calcSize() {
    const w = Math.max(1, Math.round(this.opts.resolution * this.gl.width));
    const h = Math.max(1, Math.round(this.opts.resolution * this.gl.height));
    this.cellScale.set(1 / w, 1 / h);
    this.fboSize.set(w, h);
  }

  private _makeFBO() {
    return new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
  }

  private _createFBOs() {
    for (const n of ["vel_0", "vel_1", "div", "p0", "p1"]) this.fbos[n] = this._makeFBO();
  }

  private _createPasses() {
    const { fbos, cellScale, fboSize, opts, _r: r } = this;

    this.advection = new ShaderPass(
      r,
      face_vert,
      advection_frag,
      {
        boundarySpace: { value: cellScale },
        px: { value: cellScale },
        fboSize: { value: fboSize },
        velocity: { value: fbos.vel_0.texture },
        dt: { value: opts.dt },
        isBFECC: { value: false },
      },
      fbos.vel_1,
    );

    const efScene = new THREE.Scene();
    const efCam = new THREE.Camera();
    const efMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.RawShaderMaterial({
        vertexShader: mouse_vert,
        fragmentShader: externalForce_frag,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          px: { value: cellScale },
          force: { value: new THREE.Vector2() },
          center: { value: new THREE.Vector2() },
          scale: { value: new THREE.Vector2(opts.cursor_size, opts.cursor_size) },
        },
      }),
    );
    efScene.add(efMesh);
    this.externalForce = { scene: efScene, camera: efCam, mesh: efMesh };

    this.divergencePass = new ShaderPass(
      r,
      face_vert,
      divergence_frag,
      {
        boundarySpace: { value: cellScale },
        velocity: { value: fbos.vel_1.texture },
        px: { value: cellScale },
        dt: { value: opts.dt },
      },
      fbos.div,
    );

    this.poissonPass = new ShaderPass(
      r,
      face_vert,
      poisson_frag,
      {
        boundarySpace: { value: cellScale },
        pressure: { value: fbos.p0.texture },
        divergence: { value: fbos.div.texture },
        px: { value: cellScale },
      },
      fbos.p1,
    );

    this.pressurePass = new ShaderPass(
      r,
      face_vert,
      pressure_frag,
      {
        boundarySpace: { value: cellScale },
        pressure: { value: fbos.p0.texture },
        velocity: { value: fbos.vel_1.texture },
        px: { value: cellScale },
        dt: { value: opts.dt },
      },
      fbos.vel_0,
    );
  }

  resize() {
    this._calcSize();
    for (const k in this.fbos) this.fbos[k].setSize(this.fboSize.x, this.fboSize.y);
  }

  update() {
    const { opts, mouse, fbos } = this;
    const r = this.gl.renderer;
    if (!r) return;

    this.advection.render();

    {
      const cs = opts.cursor_size;
      const cx = this.cellScale.x;
      const cy = this.cellScale.y;
      const clampedX = Math.min(
        Math.max(mouse.coords.x, -1 + cs * cx * 2 + cx * 2),
        1 - cs * cx * 2 - cx * 2,
      );
      const clampedY = Math.min(
        Math.max(mouse.coords.y, -1 + cs * cy * 2 + cy * 2),
        1 - cs * cy * 2 - cy * 2,
      );
      const u = (this.externalForce.mesh.material as THREE.RawShaderMaterial).uniforms;
      u.force.value.set((mouse.diff.x / 2) * opts.mouse_force, (mouse.diff.y / 2) * opts.mouse_force);
      u.center.value.set(clampedX, clampedY);
      r.setRenderTarget(fbos.vel_1);
      r.render(this.externalForce.scene, this.externalForce.camera);
      r.setRenderTarget(null);
    }

    this.divergencePass.render();

    let p_out = fbos.p1;
    for (let i = 0; i < opts.iterations_poisson; i++) {
      const p_in = i % 2 === 0 ? fbos.p0 : fbos.p1;
      p_out = i % 2 === 0 ? fbos.p1 : fbos.p0;
      this.poissonPass.uniforms.pressure.value = p_in.texture;
      this.poissonPass.render(p_out);
    }
    this.pressurePass.uniforms.pressure.value = p_out.texture;
    this.pressurePass.render();
  }

  dispose() {
    for (const k in this.fbos) this.fbos[k].dispose();
    this.advection.dispose();
    this.divergencePass.dispose();
    this.poissonPass.dispose();
    this.pressurePass.dispose();
    (this.externalForce.mesh.material as THREE.Material).dispose();
    this.externalForce.mesh.geometry.dispose();
  }
}

export interface FundoLiquidoProps {
  /** tamanho do bloco de pixel, em px */
  pixel?: number;
  /** resolução da simulação relativa ao contêiner (0–1; menor = mais leve) */
  resolucao?: number;
  forcaDoCursor?: number;
  raioDoCursor?: number;
  /** piloto automático quando ninguém mexe */
  automatico?: boolean;
  className?: string;
}

export default function FundoLiquido({
  pixel = 14,
  resolucao = 0.35,
  forcaDoCursor = 7,
  raioDoCursor = 110,
  automatico = true,
  className = "",
}: FundoLiquidoProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const gl = new CommonGL();
    try {
      gl.init(container);
    } catch {
      // sem WebGL utilizável (lista negra de driver, contexto negado): fica a
      // aurora em CSS que a seção já pinta por baixo.
      return;
    }
    container.prepend(gl.renderer!.domElement);

    const mouse = new MouseGL();
    mouse.init(container);
    mouse.autoIntensity = 1.8;

    const palette = makePaletteTexture(PALETA_GALE);
    const bayerTex = makeBayerTexture();

    const sim = new FluidSim(gl, mouse, {
      resolution: resolucao,
      mouse_force: forcaDoCursor,
      cursor_size: raioDoCursor,
      dt: 0.008,
      iterations_poisson: 8,
    });

    const outputUniforms: Uniforms = {
      velocity: { value: sim.fbos.vel_0.texture },
      palette: { value: palette },
      uBayer: { value: bayerTex },
      // branco transparente: onde o fluido está parado, a seção aparece
      bgColor: { value: new THREE.Vector4(1, 1, 1, 0) },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(gl.width, gl.height) },
      uPixelSize: { value: pixel },
      uGrain: { value: 0.035 },
      boundarySpace: { value: new THREE.Vector2() },
      px: { value: new THREE.Vector2() },
    };
    const outputScene = new THREE.Scene();
    const outputCam = new THREE.Camera();
    const outputMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.RawShaderMaterial({
        vertexShader: face_vert,
        fragmentShader: color_frag,
        transparent: true,
        depthWrite: false,
        uniforms: outputUniforms,
      }),
    );
    outputScene.add(outputMesh);

    let lastInteraction = performance.now();
    mouse.onInteract = () => {
      lastInteraction = performance.now();
    };
    const driver = automatico
      ? new AutoDriver(mouse, () => lastInteraction, 0.4, 1200)
      : null;

    const handleResize = () => {
      gl.resize();
      sim.resize();
      (outputUniforms.uRes.value as THREE.Vector2).set(gl.width, gl.height);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let raf = 0;
    let visivel = true;
    let abaAtiva = !document.hidden;
    let rodando = false;

    const loop = () => {
      if (!rodando) return;
      raf = requestAnimationFrame(loop);
      driver?.update();
      mouse.update();
      gl.update();
      outputUniforms.uTime.value = gl.time;
      sim.update();
      const r = gl.renderer;
      if (r) {
        r.setRenderTarget(null);
        r.render(outputScene, outputCam);
      }
    };

    const sincronizar = () => {
      const deveRodar = visivel && abaAtiva;
      if (deveRodar && !rodando) {
        rodando = true;
        gl.clock?.getDelta(); // zera o delta acumulado na pausa
        loop();
      } else if (!deveRodar && rodando) {
        rodando = false;
        cancelAnimationFrame(raf);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        visivel = entries.some((e) => e.isIntersecting);
        sincronizar();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      abaAtiva = !document.hidden;
      sincronizar();
    };
    document.addEventListener("visibilitychange", onVisibility);
    sincronizar();

    return () => {
      rodando = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mouse.dispose();
      sim.dispose();
      palette.dispose();
      bayerTex.dispose();
      (outputMesh.material as THREE.Material).dispose();
      outputMesh.geometry.dispose();
      const canvas = gl.renderer?.domElement;
      gl.renderer?.dispose();
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [pixel, resolucao, forcaDoCursor, raioDoCursor, automatico]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden opacity-85 ${className}`}
    />
  );
}
