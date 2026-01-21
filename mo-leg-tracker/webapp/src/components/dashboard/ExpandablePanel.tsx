'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

interface ExpandablePanelProps {
  children: ReactNode;
  /** Height when collapsed (e.g., '200px', '12rem') */
  collapsedHeight?: string;
  /** Height when expanded but not fullscreen (e.g., '500px', 'auto') */
  expandedHeight?: string;
  /** Whether to start expanded (uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Controlled expanded state - when provided, component is controlled */
  expanded?: boolean;
  /** Callback when expanded state changes (for controlled mode) */
  onExpandedChange?: (expanded: boolean) => void;
  /** Custom class for the container */
  className?: string;
  /** Show gradient fade at bottom when collapsed */
  showFade?: boolean;
  /** Render prop for header - receives control buttons to place where needed */
  renderHeader?: (controls: ReactNode) => ReactNode;
  /** Header background class */
  headerClassName?: string;
}

export function ExpandablePanel({
  children,
  collapsedHeight = '180px',
  expandedHeight = '450px',
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
  showFade = true,
  renderHeader,
  headerClassName,
}: ExpandablePanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const setIsExpanded = (value: boolean) => {
    if (isControlled) {
      onExpandedChange?.(value);
    } else {
      setInternalExpanded(value);
    }
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const currentHeight = isExpanded ? expandedHeight : collapsedHeight;

  const controlButtons = (
    <div className="flex items-center gap-1 text-white">
      {!isFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
          title={isExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsFullscreen(!isFullscreen);
        }}
        className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-5 h-5" />
        ) : (
          <Maximize2 className="w-5 h-5" />
        )}
      </button>
    </div>
  );

  const panelContent = (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
        className
      )}
    >
      {/* Header with controls embedded via render prop */}
      {renderHeader && (
        <div className={headerClassName}>
          {renderHeader(controlButtons)}
        </div>
      )}

      {/* Content area */}
      <div
        ref={contentRef}
        className={cn(
          'overflow-y-auto transition-all duration-300 ease-in-out relative flex-1',
          !isFullscreen && !renderHeader && 'rounded-xl'
        )}
        style={{
          maxHeight: isFullscreen ? 'none' : currentHeight,
          height: isFullscreen ? '100%' : 'auto',
        }}
      >
        {children}

        {/* Fade overlay when collapsed */}
        {showFade && !isExpanded && !isFullscreen && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>

      {/* Footer expand button when collapsed (no header case) */}
      {!renderHeader && !isFullscreen && (
        <div className="flex items-center justify-center gap-2 py-2 border-t border-gray-100 bg-gray-50">
          {controlButtons}
        </div>
      )}
    </div>
  );

  // Fullscreen backdrop portal
  if (isFullscreen && mounted) {
    return (
      <>
        {/* Placeholder to maintain layout */}
        <div style={{ height: currentHeight }} className={className} />

        {createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsFullscreen(false)}
            />
            {panelContent}
          </>,
          document.body
        )}
      </>
    );
  }

  return panelContent;
}

export default ExpandablePanel;
