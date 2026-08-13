export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: number
          imagem_path: string | null
          legado_id: number | null
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: never
          imagem_path?: string | null
          legado_id?: number | null
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: never
          imagem_path?: string | null
          legado_id?: number | null
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          cadastrado_em: string | null
          cep: string | null
          cidade: string | null
          cliente_antigo: boolean
          complemento: string | null
          created_at: string
          data_nascimento: string | null
          documento: string | null
          email: string | null
          id: number
          inscricao_estadual: string | null
          legado_id: number | null
          logradouro: string | null
          nome: string
          nome_contato: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          pais: string | null
          pode_ver_precos: boolean
          rg: string | null
          status: Database["public"]["Enums"]["cliente_status"]
          telefone1: string | null
          telefone2: string | null
          telefone3: string | null
          tipo_compra: Database["public"]["Enums"]["tipo_compra"]
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bairro?: string | null
          cadastrado_em?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_antigo?: boolean
          complemento?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          id?: never
          inscricao_estadual?: string | null
          legado_id?: number | null
          logradouro?: string | null
          nome: string
          nome_contato?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          pode_ver_precos?: boolean
          rg?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone1?: string | null
          telefone2?: string | null
          telefone3?: string | null
          tipo_compra?: Database["public"]["Enums"]["tipo_compra"]
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bairro?: string | null
          cadastrado_em?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_antigo?: boolean
          complemento?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          id?: never
          inscricao_estadual?: string | null
          legado_id?: number | null
          logradouro?: string | null
          nome?: string
          nome_contato?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          pode_ver_precos?: boolean
          rg?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone1?: string | null
          telefone2?: string | null
          telefone3?: string | null
          tipo_compra?: Database["public"]["Enums"]["tipo_compra"]
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      fabricantes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: number
          legado_id: number | null
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: never
          legado_id?: number | null
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: never
          legado_id?: number | null
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      kits: {
        Row: {
          ativo: boolean
          descricao: string
          id: number
          legado_id: number | null
          ordem: number
          pecas: number
        }
        Insert: {
          ativo?: boolean
          descricao: string
          id?: never
          legado_id?: number | null
          ordem?: number
          pecas: number
        }
        Update: {
          ativo?: boolean
          descricao?: string
          id?: never
          legado_id?: number | null
          ordem?: number
          pecas?: number
        }
        Relationships: []
      }
      log_atividades: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: never
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: never
          user_id?: string | null
        }
        Relationships: []
      }
      pedido_itens: {
        Row: {
          id: number
          pecas_no_kit: number
          pedido_id: number
          preco_kit_atacado: number
          preco_kit_varejo: number
          preco_unitario_atacado: number | null
          preco_unitario_varejo: number | null
          produto_id: number | null
          produto_modelo: string
          produto_tamanho_id: number | null
          produto_titulo: string
          qtd_kits: number
          tamanho: string | null
          total_atacado: number | null
          total_pecas: number | null
          total_varejo: number | null
        }
        Insert: {
          id?: never
          pecas_no_kit: number
          pedido_id: number
          preco_kit_atacado: number
          preco_kit_varejo: number
          preco_unitario_atacado?: number | null
          preco_unitario_varejo?: number | null
          produto_id?: number | null
          produto_modelo: string
          produto_tamanho_id?: number | null
          produto_titulo: string
          qtd_kits: number
          tamanho?: string | null
          total_atacado?: number | null
          total_pecas?: number | null
          total_varejo?: number | null
        }
        Update: {
          id?: never
          pecas_no_kit?: number
          pedido_id?: number
          preco_kit_atacado?: number
          preco_kit_varejo?: number
          preco_unitario_atacado?: number | null
          preco_unitario_varejo?: number | null
          produto_id?: number | null
          produto_modelo?: string
          produto_tamanho_id?: number | null
          produto_titulo?: string
          qtd_kits?: number
          tamanho?: string | null
          total_atacado?: number | null
          total_pecas?: number | null
          total_varejo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "precos_visiveis"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_tamanho_id_fkey"
            columns: ["produto_tamanho_id"]
            isOneToOne: false
            referencedRelation: "precos_visiveis"
            referencedColumns: ["produto_tamanho_id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_tamanho_id_fkey"
            columns: ["produto_tamanho_id"]
            isOneToOne: false
            referencedRelation: "produto_tamanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: number
          criado_em: string
          desconto: number
          id: number
          legado_id: number | null
          numero: string
          observacoes_admin: string | null
          observacoes_cliente: string | null
          snapshot_cliente: Json
          status: Database["public"]["Enums"]["pedido_status"]
          total_atacado: number
          total_pecas: number
          total_varejo: number
          updated_at: string
          vinculo_revisar: boolean
        }
        Insert: {
          cliente_id: number
          criado_em?: string
          desconto?: number
          id?: never
          legado_id?: number | null
          numero: string
          observacoes_admin?: string | null
          observacoes_cliente?: string | null
          snapshot_cliente?: Json
          status?: Database["public"]["Enums"]["pedido_status"]
          total_atacado?: number
          total_pecas?: number
          total_varejo?: number
          updated_at?: string
          vinculo_revisar?: boolean
        }
        Update: {
          cliente_id?: number
          criado_em?: string
          desconto?: number
          id?: never
          legado_id?: number | null
          numero?: string
          observacoes_admin?: string | null
          observacoes_cliente?: string | null
          snapshot_cliente?: Json
          status?: Database["public"]["Enums"]["pedido_status"]
          total_atacado?: number
          total_pecas?: number
          total_varejo?: number
          updated_at?: string
          vinculo_revisar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_imagens: {
        Row: {
          alt: string | null
          created_at: string
          id: number
          legado_url: string | null
          ordem: number
          principal: boolean
          produto_id: number
          storage_path: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: never
          legado_url?: string | null
          ordem?: number
          principal?: boolean
          produto_id: number
          storage_path: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: never
          legado_url?: string | null
          ordem?: number
          principal?: boolean
          produto_id?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_imagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "precos_visiveis"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_imagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_tamanhos: {
        Row: {
          ativo: boolean
          id: number
          legado_id: number | null
          ncm: string | null
          ordem: number
          preco_atacado: number | null
          preco_varejo: number | null
          produto_id: number
          tamanho_id: number
        }
        Insert: {
          ativo?: boolean
          id?: never
          legado_id?: number | null
          ncm?: string | null
          ordem?: number
          preco_atacado?: number | null
          preco_varejo?: number | null
          produto_id: number
          tamanho_id: number
        }
        Update: {
          ativo?: boolean
          id?: never
          legado_id?: number | null
          ncm?: string | null
          ordem?: number
          preco_atacado?: number | null
          preco_varejo?: number | null
          produto_id?: number
          tamanho_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_tamanhos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "precos_visiveis"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_tamanhos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_tamanhos_tamanho_id_fkey"
            columns: ["tamanho_id"]
            isOneToOne: false
            referencedRelation: "tamanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          busca: unknown
          categoria_id: number
          created_at: string
          descricao: string | null
          fabricante_id: number | null
          id: number
          kit_id: number
          lancamento: boolean
          legado_id: number | null
          modelo: string
          ncm: string | null
          ordem: number
          possui_st: boolean
          preco_atacado: number
          preco_varejo: number
          slug: string
          subcategoria_id: number | null
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          busca?: unknown
          categoria_id: number
          created_at?: string
          descricao?: string | null
          fabricante_id?: number | null
          id?: never
          kit_id: number
          lancamento?: boolean
          legado_id?: number | null
          modelo: string
          ncm?: string | null
          ordem?: number
          possui_st?: boolean
          preco_atacado?: number
          preco_varejo?: number
          slug: string
          subcategoria_id?: number | null
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          busca?: unknown
          categoria_id?: number
          created_at?: string
          descricao?: string | null
          fabricante_id?: number | null
          id?: never
          kit_id?: number
          lancamento?: boolean
          legado_id?: number | null
          modelo?: string
          ncm?: string | null
          ordem?: number
          possui_st?: boolean
          preco_atacado?: number
          preco_varejo?: number
          slug?: string
          subcategoria_id?: number | null
          tags?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      subcategorias: {
        Row: {
          ativo: boolean
          categoria_id: number
          created_at: string
          descricao: string | null
          id: number
          legado_id: number | null
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: number
          created_at?: string
          descricao?: string | null
          id?: never
          legado_id?: number | null
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: number
          created_at?: string
          descricao?: string | null
          id?: never
          legado_id?: number | null
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      tamanhos: {
        Row: {
          ativo: boolean
          id: number
          legado_id: number | null
          ordem: number
          tipo: string
          valor: string
        }
        Insert: {
          ativo?: boolean
          id?: never
          legado_id?: number | null
          ordem?: number
          tipo?: string
          valor: string
        }
        Update: {
          ativo?: boolean
          id?: never
          legado_id?: number | null
          ordem?: number
          tipo?: string
          valor?: string
        }
        Relationships: []
      }
    }
    Views: {
      precos_visiveis: {
        Row: {
          pecas_no_kit: number | null
          preco_base_atacado: number | null
          preco_base_varejo: number | null
          preco_kit_atacado: number | null
          preco_kit_varejo: number | null
          preco_proprio_atacado: number | null
          preco_proprio_varejo: number | null
          preco_unitario_atacado: number | null
          preco_unitario_varejo: number | null
          produto_id: number | null
          produto_tamanho_id: number | null
          tamanho: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      meu_cliente_id: { Args: never; Returns: number }
      pode_ver_precos: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "cliente"
      cliente_status: "inativo" | "ativo" | "incompleto"
      pedido_status:
        | "novo"
        | "em_contato"
        | "aguardando_pagamento"
        | "pago"
        | "em_separacao"
        | "enviado"
        | "concluido"
        | "cancelado"
      tipo_compra: "atacado" | "varejo"
      tipo_pessoa: "fisica" | "juridica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cliente"],
      cliente_status: ["inativo", "ativo", "incompleto"],
      pedido_status: [
        "novo",
        "em_contato",
        "aguardando_pagamento",
        "pago",
        "em_separacao",
        "enviado",
        "concluido",
        "cancelado",
      ],
      tipo_compra: ["atacado", "varejo"],
      tipo_pessoa: ["fisica", "juridica"],
    },
  },
} as const

