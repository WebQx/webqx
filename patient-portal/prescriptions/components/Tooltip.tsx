import React, { useState, useRef, useEffect } from 'react';
import { TooltipContent } from '../types';

/**
 * Tooltip component for providing additional help information
 */
interface TooltipProps {
  /** Tooltip configuration */
  tooltip: TooltipContent;
  /** Children to wrap with tooltip */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  tooltip,
  children,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (tooltip.trigger === 'hover' || tooltip.trigger === 'focus') {
      setIsVisible(true);
      updatePosition();
    }
  };

  const hideTooltip = () => {
    if (tooltip.trigger === 'hover' || tooltip.trigger === 'focus') {
      setIsVisible(false);
    }
  };

  const toggleTooltip = () => {
    if (tooltip.trigger === 'click') {
      setIsVisible(!isVisible);
      if (!isVisible) {
        updatePosition();
      }
    }
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (tooltip.position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }

    // Adjust for viewport boundaries
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    setPosition({ top, left });
  };

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltip.trigger === 'click' &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, tooltip.trigger]);

  // Handle escape key to close tooltip
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  return (
    <div className={`tooltip-wrapper ${className}`} ref={triggerRef}>
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={toggleTooltip}
        tabIndex={tooltip.trigger === 'click' ? 0 : -1}
        role={tooltip.trigger === 'click' ? 'button' : undefined}
        aria-describedby={isVisible ? tooltip.id : undefined}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltip.id}
          className={`tooltip tooltip-${tooltip.position}`}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 1000
          }}
          role="tooltip"
          aria-hidden={!isVisible}
        >
          {tooltip.title && (
            <div className="tooltip-title">{tooltip.title}</div>
          )}
          <div className="tooltip-content">{tooltip.content}</div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;