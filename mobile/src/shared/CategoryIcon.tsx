/**
 * CategoryIcon — renders the correct icon component for a category.
 * Ionicons for most categories, MaterialCommunityIcons for Fuel (gas-station).
 */
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryIcon } from './categoryMap';

interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export default function CategoryIcon({ category, size = 18, color }: CategoryIconProps) {
  const icon = getCategoryIcon(category);
  if (icon === 'gas-station-outline') {
    return <MaterialCommunityIcons name="gas-station-outline" size={size} color={color} />;
  }
  return <Ionicons name={icon as any} size={size} color={color} />;
}