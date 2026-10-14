// Sample gesture image generators for instant testing when live webcam is denied or unavailable

export interface SampleGesture {
  id: string;
  name: string;
  spokenText: string;
  icon: string;
  category: string;
  description: string;
  renderToCanvas: (canvas: HTMLCanvasElement) => void;
}

/** A plain still card for a sample sign: the name and how it is formed, set quietly on a dark ground. */
function renderSampleCard(canvas: HTMLCanvasElement, sample: Pick<SampleGesture, 'name' | 'description'>) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = 640;
  canvas.height = 480;
  ctx.fillStyle = '#131f24';
  ctx.fillRect(0, 0, 640, 480);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6f8590';
  ctx.font = '800 16px Nunito, sans-serif';
  ctx.fillText('SAMPLE SIGN', 56, 96);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 68px Nunito, sans-serif';
  ctx.fillText(sample.name, 56, 176);

  ctx.fillStyle = '#b4c1c8';
  ctx.font = '700 22px Nunito, sans-serif';
  const words = sample.description.split(' ');
  let line = '';
  let y = 232;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 520 && line) {
      ctx.fillText(line, 56, y);
      line = w;
      y += 32;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 56, y);
}

export const SAMPLE_GESTURES: SampleGesture[] = [
  {
    id: 'thank_you',
    name: 'Thank You',
    spokenText: 'Thank you very much!',
    icon: '🙏',
    category: 'common',
    description: 'Flat open hand starting at chin and moving forward toward the conversational partner',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
  {
    id: 'hello',
    name: 'Hello / Wave',
    spokenText: 'Hello there, nice to meet you!',
    icon: '👋',
    category: 'common',
    description: 'Open flat hand near temple waving outward in friendly greeting',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
  {
    id: 'i_love_you',
    name: 'I Love You',
    spokenText: 'I love you!',
    icon: '🤟',
    category: 'common',
    description: 'ASL ILY sign with thumb, index, and pinky extended, middle and ring curled',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
  {
    id: 'yes',
    name: 'Yes',
    spokenText: 'Yes, that is correct.',
    icon: '👍',
    category: 'common',
    description: 'Closed fist bobbing up and down like a nodding head',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
  {
    id: 'help',
    name: 'Help',
    spokenText: 'Could you please help me?',
    icon: '🆘',
    category: 'survival',
    description: 'Thumbs-up fist on flat supporting palm lifted upward',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
  {
    id: 'letter_a',
    name: 'Letter A',
    spokenText: 'Letter A',
    icon: '🅰️',
    category: 'alphabet',
    description: 'Fist with thumb upright along the side of index finger',
    renderToCanvas(canvas) {
      renderSampleCard(canvas, this);
    },
  },
];
