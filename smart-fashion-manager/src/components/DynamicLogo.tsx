import React from 'react';
import { BRAND } from '../brand';

interface DynamicLogoProps {
  size?: 'small' | 'medium' | 'large' | 'original' | 'xl' | 'icon';
  variant?: 'icon' | 'full' | 'text' | 'shield';
  className?: string;
  isPrint?: boolean;
  customLogoUrl?: string;
}

export const DynamicLogo: React.FC<DynamicLogoProps> = ({
  size = 'medium',
  className = '',
  isPrint = false,
}) => {
  let sizeClass = 'h-12';
  if (isPrint) {
    sizeClass = 'h-6 max-h-7 w-auto';
  } else if (size === 'small' || size === 'icon') {
    sizeClass = 'h-8 w-auto';
  } else if (size === 'medium') {
    sizeClass = 'h-12 w-auto';
  } else if (size === 'large') {
    sizeClass = 'h-16 w-auto';
  } else if (size === 'xl') {
    sizeClass = 'h-24 w-auto';
  } else if (size === 'original') {
    sizeClass = 'max-h-32 w-auto';
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={BRAND.logo}
        alt={BRAND.name}
        className={`${sizeClass} object-contain`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
