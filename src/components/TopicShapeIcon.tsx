import React from 'react';
import type { TopicShape } from '../types';

interface TopicShapeIconProps {
  shape: TopicShape;
  color: string;
  size?: number;
  className?: string;
}

export const TopicShapeIcon: React.FC<TopicShapeIconProps> = ({
  shape,
  color,
  size = 24,
  className = '',
}) => {
  const fill = color.toLowerCase() === '#ffffff' ? 'var(--m3-primary)' : color;

  const renderShape = () => {
    switch (shape) {
      case 'CIRCLE':
        return <circle cx="12" cy="12" r="9.5" fill={fill} />;
      case 'SQUARE':
        return <rect x="3" y="3" width="18" height="18" rx="4.5" fill={fill} />;
      case 'DIAMOND':
        return <rect x="12" y="2" width="14" height="14" rx="3" transform="rotate(45 12 2)" fill={fill} />;
      case 'PILL':
        return <rect x="2" y="6" width="20" height="12" rx="6" fill={fill} />;
      case 'PENTAGON':
        return (
          <path
            d="M12 2.5L21 9.2L17.6 19.8H6.4L3 9.2L12 2.5Z"
            fill={fill}
            stroke={fill}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        );
      case 'HEART':
        return (
          <path
            d="M12 20.5C12 20.5 3.5 15.2 3.5 8.8C3.5 5.9 5.8 3.8 8.4 3.8C10 3.8 11.4 4.6 12 5.9C12.6 4.6 14 3.8 15.6 3.8C18.2 3.8 20.5 5.9 20.5 8.8C20.5 15.2 12 20.5 12 20.5Z"
            fill={fill}
          />
        );
      case 'CLOVER_4_LEAF':
        return (
          <g fill={fill}>
            <circle cx="8.5" cy="8.5" r="5" />
            <circle cx="15.5" cy="8.5" r="5" />
            <circle cx="8.5" cy="15.5" r="5" />
            <circle cx="15.5" cy="15.5" r="5" />
          </g>
        );
      case 'FLOWER':
        return (
          <g fill={fill}>
            <circle cx="12" cy="6.2" r="4" />
            <circle cx="17.5" cy="10.2" r="4" />
            <circle cx="15.4" cy="16.6" r="4" />
            <circle cx="8.6" cy="16.6" r="4" />
            <circle cx="6.5" cy="10.2" r="4" />
            <circle cx="12" cy="12" r="4.5" />
          </g>
        );
      case 'SUNNY':
        return (
          <path
            d="M12 1.8L14.5 4.8L18.4 4.4L19.1 8.2L22.2 10.6L20.5 14.1L21.5 17.9L17.9 19.2L16.3 22.7L12.6 21.5L9.1 22.7L7.5 19.2L3.9 17.9L4.9 14.1L3.2 10.6L6.3 8.2L7 4.4L10.9 4.8L12 1.8Z"
            fill={fill}
          />
        );
      case 'BURST':
        return (
          <path
            d="M12 1.5L14.4 6.5L19.8 4.8L18.2 10.2L22.8 13.4L17.5 15.6L18.2 21.2L13 18.8L9.2 22.6L8 17.1L2.6 16.5L6.1 12.1L3.5 7.2L9 7.6L12 1.5Z"
            fill={fill}
          />
        );
      case 'GEM':
        return (
          <path
            d="M7 3.5H17L21.5 9.5L12 20.8L2.5 9.5L7 3.5Z"
            fill={fill}
            stroke={fill}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        );
      case 'COOKIE_7_SIDED':
      default:
        return (
          <path
            d="M12 2.2C13.9 2.2 15.1 3.7 16.8 4.4C18.5 5.1 20.3 4.9 21.2 6.5C22.1 8.1 21.1 9.8 21.5 11.6C21.9 13.4 23 14.9 22 16.5C21 18.1 19 18.1 17.7 19.4C16.4 20.7 15.9 22.5 14 22.6C12.1 22.7 11.1 21.1 9.3 20.7C7.5 20.3 5.7 21 4.5 19.6C3.3 18.2 4 16.4 3.3 14.7C2.6 13 1.3 11.7 2 10C2.7 8.3 4.6 8 5.7 6.5C6.8 5 7 3.1 8.8 2.6C10.1 2.2 11 2.2 12 2.2Z"
            fill={fill}
          />
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {renderShape()}
    </svg>
  );
};
