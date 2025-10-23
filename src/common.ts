import type { Engine } from "@babylonjs/core/Engines/engine";

export function resetEngineState(engine: Engine) {
  const gl = engine._gl;

  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.disable(gl.POLYGON_OFFSET_FILL);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);

  gl.colorMask(true, true, true, true);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);

  engine._currentFramebuffer = null;

  // Restore default framebuffer
  engine.restoreDefaultFramebuffer();

  // Reset viewport & scissor
  const canvas = engine.getRenderingCanvas();
  if (canvas) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
  }

  // Reset blend equation & color
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);

  // Reset texture bindings
  const maxTextureUnits = engine.getCaps().maxCombinedTexturesImageUnits;
  for (let i = 0; i < maxTextureUnits; i++) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }

  engine.wipeCaches(true);
}
