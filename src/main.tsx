import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

declare global {
  interface Window {
    __APP_MOUNTED__?: boolean;
  }
}

window.__APP_MOUNTED__ = true;

// Polyfill de seguridad para ctx.roundRect en navegadores móviles antiguos
if (
  typeof CanvasRenderingContext2D !== 'undefined' &&
  !CanvasRenderingContext2D.prototype.roundRect
) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    radii?: number | DOMPointInit | (number | DOMPointInit)[]
  ) {
    const r = typeof radii === 'number' ? Math.min(radii, Math.abs(w) / 2, Math.abs(h) / 2) : 4;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

class SafeBootBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; retryKey: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    try {
      localStorage.removeItem('survivor_io_openworld_save_v1');
    } catch {
      // ignore
    }
  }

  handleRecoverNow = () => {
    try {
      localStorage.removeItem('survivor_io_openworld_save_v1');
      sessionStorage.setItem('survivor_auth_ok', 'true');
    } catch {
      // ignore
    }
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="text-5xl mb-3">🗡️</div>
          <h1 className="font-survivor text-2xl mb-2">Datos Actualizados a Nueva Versión</h1>
          <p className="text-xs text-slate-300 mb-4">
            Se reparó la caché de versión anterior automáticamente.
          </p>
          <button
            type="button"
            onClick={this.handleRecoverNow}
            className="px-6 py-3 rounded-2xl bg-emerald-500 text-white font-survivor text-lg survivor-btn cursor-pointer"
          >
            ENTRAR AL JUEGO AHORA
          </button>
        </div>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SafeBootBoundary>
      <App />
    </SafeBootBoundary>
  </React.StrictMode>
);
