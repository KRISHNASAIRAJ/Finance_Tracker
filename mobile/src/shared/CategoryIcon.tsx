/**
 * CategoryIcon — renders the correct icon glyph for a category.
 * Ionicons for most categories, MaterialCommunityIcons for Fuel (gas-station).
 * Glyphs are the flat, solid OxygenOS-style MaterialCommunityIcons set (see categoryMap).
 */
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryIcon } from './categoryMap';

interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export default function CategoryIcon({ category, size = 18, color }: CategoryIconProps) {
  const icon = getCategoryIcon(category);
  return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
}
