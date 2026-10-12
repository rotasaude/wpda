// Celular = lado menor da tela física < 600px E toque como entrada principal
// (decisão 9 do ciclo de interface). Girar o celular ou dar zoom não muda
// `screen`; diminuir a janela no desktop não libera.
export function isPhone(win: Window = window): boolean {
  const shortest = Math.min(win.screen.width, win.screen.height);
  let coarse = false;
  try { coarse = win.matchMedia("(pointer: coarse)").matches; } catch { coarse = false; }
  return shortest < 600 && coarse;
}
