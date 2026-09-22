import { BaseUser } from '../../../shared/types/user';

type RGB = {
  r: number;
  g: number;
  b: number;
};

type HSV = {
  h: number;
  s: number;
  v: number;
};

function HSV2RGB(hsv: HSV): RGB {
  let { h, s, v } = hsv;
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function RGB2STR(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function getUOJColOfRating(rating: number): string {
  if (rating < 1500) {
    const H = 300 - ((1500 - 850) * 300) / 1650,
      S = 30 + ((1500 - 850) * 70) / 1650,
      V = 50 + ((1500 - 850) * 50) / 1650;
    if (rating < 300) rating = 300;
    const k = (rating - 300) / 1200;
    return RGB2STR(
      HSV2RGB({
        h: H + (300 - H) * (1 - k),
        s: 30 + (S - 30) * k,
        v: 50 + (V - 50) * k,
      })
    );
  }
  if (rating > 2500) {
    rating = 2500;
  }
  return RGB2STR(
    HSV2RGB({
      h: 300 - ((rating - 850) * 300) / 1650,
      s: 30 + ((rating - 850) * 70) / 1650,
      v: 50 + ((rating - 850) * 50) / 1650,
    })
  );
}

export default function getUsernameColor(user: BaseUser) {
  return getUOJColOfRating((user.uojRating as number | null) ?? 1500);
}
