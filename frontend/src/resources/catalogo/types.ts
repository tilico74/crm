// Catálogo (T103): tipos da API /unidades, /marcas, /categorias e /subcategorias.

export type Unidade = { id?: number; sigla: string; nome: string; sistema: boolean };
export type Marca = { id?: number; nome: string; imagem: string | null };
export type Subcategoria = { id?: number; nome: string; categoria?: number };
export type Categoria = { id: number; nome: string; subcategorias: Subcategoria[] };
