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

export const SAMPLE_GESTURES: SampleGesture[] = [
  {
    id: 'thank_you',
    name: 'Thank You',
    spokenText: 'Thank you very much!',
    icon: '🙏',
    category: 'common',
    description: 'Flat open hand starting at chin and moving forward toward the conversational partner',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      // Dark background with gradient
      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      // Card container
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      // Hand representation
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🙏', 320, 210);

      // Label & Description for Multimodal Vision
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL SIGN: THANK YOU', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('Hand flat at chin moving forward outward', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
  {
    id: 'hello',
    name: 'Hello / Wave',
    spokenText: 'Hello there, nice to meet you!',
    icon: '👋',
    category: 'common',
    description: 'Open flat hand near temple waving outward in friendly greeting',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👋', 320, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL SIGN: HELLO', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('Open flat palm waving at forehead/temple', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
  {
    id: 'i_love_you',
    name: 'I Love You',
    spokenText: 'I love you!',
    icon: '🤟',
    category: 'common',
    description: 'ASL ILY sign with thumb, index, and pinky extended, middle and ring curled',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🤟', 320, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL SIGN: I LOVE YOU', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('Thumb, index, and pinky fingers upright', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
  {
    id: 'yes',
    name: 'Yes',
    spokenText: 'Yes, that is correct.',
    icon: '👍',
    category: 'common',
    description: 'Closed fist bobbing up and down like a nodding head',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✊', 320, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL SIGN: YES', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('S-hand fist nodding up and down from wrist', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
  {
    id: 'help',
    name: 'Help',
    spokenText: 'Could you please help me?',
    icon: '🆘',
    category: 'survival',
    description: 'Thumbs-up fist on flat supporting palm lifted upward',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🆘', 320, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL SIGN: HELP', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('Closed fist with upright thumb lifted on flat palm', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
  {
    id: 'letter_a',
    name: 'Letter A',
    spokenText: 'Letter A',
    icon: '🅰️',
    category: 'alphabet',
    description: 'Fist with thumb upright along the side of index finger',
    renderToCanvas: (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 640;
      canvas.height = 480;

      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.roundRect(80, 40, 480, 400, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🅰️', 320, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ASL FINGERSPELLING: A', 320, 280);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText('Fist with thumb along the outside edge', 320, 320);
      ctx.fillText('(Sample Demonstration Sign)', 320, 355);
    },
  },
];
