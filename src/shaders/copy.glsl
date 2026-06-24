// copy.glsl — blit a texture straight to the bound framebuffer.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;

void main() {
  fragColor = vec4(texture(uTex, vUv).rgb, 1.0);
}
