export type MenuCategory = 'plato' | 'bebida';

export interface CreateMenuItemDTO {
  category: MenuCategory;        // 'plato' | 'bebida'
  name: string;
  description: string;
  prepMinutes: number;
  price: number;
}

export interface MenuItem extends CreateMenuItemDTO {
  id: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuItemWithImagesDTO extends CreateMenuItemDTO {
  images: { filename: string; contentType: string; buffer: Buffer }[]; // exactamente 3
}
