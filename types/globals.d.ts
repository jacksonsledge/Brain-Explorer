// Globals the app's code uses that TypeScript cannot see on its own.
import * as THREE_NS from 'three';

declare global {
  // three.js r128 is loaded from cdnjs as a global; the glow code (inlined from three.js examples) adds these to it.
  const THREE: typeof THREE_NS & {
    Pass: any; FullScreenQuad: any; UnrealBloomPass: any; CopyShader: any; LuminosityHighPassShader: any;
  };
  interface Window {
    Fuse?: any;        // Fuse.js, loaded asynchronously from cdnjs for search
    goatcounter?: any; // GoatCounter, loaded only when visit counting is switched on
    MeshBVHLib?: any;  // three-mesh-bvh, inlined in index.html for faster tapping
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}
export {};
