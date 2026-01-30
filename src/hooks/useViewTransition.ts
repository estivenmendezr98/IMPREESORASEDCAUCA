import { useCallback } from 'react';

// Hook personalizado para manejar View Transitions
export function useViewTransition() {
  const startTransition = useCallback((callback: () => void | Promise<void>) => {
    // Verificar si el navegador soporta View Transitions
    if ('startViewTransition' in document) {
      // @ts-ignore - startViewTransition aún no está en los tipos de TypeScript
      document.startViewTransition(callback);
    } else {
      // Fallback para navegadores que no soportan View Transitions
      callback();
    }
  }, []);

  const isSupported = 'startViewTransition' in document;

  return { startTransition, isSupported };
}

// Utilidad para crear transiciones con nombres específicos
export function createNamedTransition(name: string) {
  return (element: HTMLElement | null) => {
    if (element) {
      element.style.viewTransitionName = name;
      
      // Cleanup function
      return () => {
        element.style.viewTransitionName = '';
      };
    }
  };
}

// Hook para transiciones de navegación
export function useNavigationTransition() {
  const { startTransition } = useViewTransition();

  const navigateWithTransition = useCallback((
    navigationCallback: () => void,
    transitionName?: string
  ) => {
    startTransition(() => {
      if (transitionName) {
        document.documentElement.setAttribute('data-transition', transitionName);
      }
      navigationCallback();
      
      // Limpiar el atributo después de la transición
      setTimeout(() => {
        document.documentElement.removeAttribute('data-transition');
      }, 300);
    });
  }, [startTransition]);

  return { navigateWithTransition };
}