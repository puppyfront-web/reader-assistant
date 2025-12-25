// Inject global CSS animations and styles for dynamic components
export function injectGlobalStyles(): void {
  const styleId = 'reader-assistant-global-styles';

  // Check if already injected
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes reader-assistant-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes reader-assistant-fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes reader-assistant-slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Apply animations to quick chat */
    #reader-assistant-quick-chat {
      animation: reader-assistant-fadeIn 0.2s ease-out !important;
    }

    /* Smooth transitions for translation blocks */
    .reader-assistant-translation {
      animation: reader-assistant-slideUp 0.3s ease-out !important;
    }
  `;

  document.head.appendChild(style);
}
