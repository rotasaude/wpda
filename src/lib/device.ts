// Celular = lado menor da tela física < 600px E toque como entrada principal
// (decisão 9 do ciclo de interface). Girar o celular ou dar zoom não muda
// `screen`; diminuir a janela no desktop não libera.
//
// Exceção do dobrável aberto (A-16): passa de 600 px no lado menor, mas o
// navegador se declara celular. iPad e tablets Android não se declaram.
function declaresPhone(win: Window): boolean {
  const nav = win.navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return nav.userAgentData?.mobile === true || /Android.*Mobile/.test(nav.userAgent);
}

export function isPhone(win: Window = window): boolean {
  const shortest = Math.min(win.screen.width, win.screen.height);
  let coarse = false;
  try { coarse = win.matchMedia("(pointer: coarse)").matches; } catch { coarse = false; }
  return coarse && (shortest < 600 || declaresPhone(win));
}
