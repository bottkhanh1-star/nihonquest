/**
 * Nihon Quest — Web Audio Voice DSP Engine
 * Provides deterministic pitch, formant, and acoustic EQ modulation
 * ensuring distinct voice personas (male, female, anime, deep, chibi)
 * even on serverless deployments (Netlify/Vercel) when cloud TTS falls back.
 */

export interface VoiceDspProfile {
  detune: number;       // Cents: -1200 to +1200 (-100 cents = 1 semitone)
  playbackRate: number; // Speed multiplier (e.g. 0.9 - 1.15)
  bassGain?: number;    // Low-shelf boost at 200Hz in dB (chest resonance for male)
  trebleGain?: number;  // Peaking/high-shelf filter at 2800Hz in dB
}

export function getVoiceDspProfile(voiceId: string, isAuthenticNeural = false): VoiceDspProfile {
  const v = (voiceId || "").toLowerCase();

  // If already synthesized by Microsoft Edge Neural natively, apply subtle adjustment only
  if (isAuthenticNeural) {
    if (v.includes("daichi")) return { detune: 150, playbackRate: 1.04 };
    if (v.includes("naoki")) return { detune: -150, playbackRate: 0.96 };
    if (v.includes("kenji")) return { detune: -250, playbackRate: 0.92, bassGain: 4 };
    if (v.includes("ren")) return { detune: 100, playbackRate: 1.12 };
    if (v.includes("aoi")) return { detune: 200, playbackRate: 1.05 };
    if (v.includes("sakura")) return { detune: 350, playbackRate: 1.10 };
    if (v.includes("mayu")) return { detune: -100, playbackRate: 0.96 };
    if (v.includes("shiori")) return { detune: -150, playbackRate: 0.92 };
    return { detune: 0, playbackRate: 1.0 };
  }

  // Fallback DSP mode: Transforms clean female Japanese TTS audio into distinct personas
  // Nam rất trầm / Uy nghiêm (Kenji, Onyx)
  if (v.includes("kenji") || v.includes("onyx")) {
    return { detune: -700, playbackRate: 0.92, bassGain: 8, trebleGain: -5 };
  }
  // Nam chuẩn Tokyo (Keita)
  if (v.includes("keita")) {
    return { detune: -550, playbackRate: 0.98, bassGain: 6, trebleGain: -3 };
  }
  // Nam MC / điềm đạm (Naoki)
  if (v.includes("naoki")) {
    return { detune: -500, playbackRate: 0.95, bassGain: 5, trebleGain: -3 };
  }
  // Nam năng động / nhiệt huyết (Daichi, Echo)
  if (v.includes("daichi") || v.includes("echo")) {
    return { detune: -400, playbackRate: 1.04, bassGain: 4, trebleGain: -2 };
  }
  // Nam thiếu niên nhanh (Ren)
  if (v.includes("ren")) {
    return { detune: -350, playbackRate: 1.12, bassGain: 3, trebleGain: -1 };
  }
  // Nữ anime chibi đáng yêu (Sakura)
  if (v.includes("sakura")) {
    return { detune: 450, playbackRate: 1.08, bassGain: -3, trebleGain: 5 };
  }
  // Nữ trẻ trung vui tươi (Aoi, Nova)
  if (v.includes("aoi") || v.includes("nova")) {
    return { detune: 300, playbackRate: 1.05, bassGain: -2, trebleGain: 3 };
  }
  // Nữ dịu dàng ấm áp (Mayu, Alloy)
  if (v.includes("mayu") || v.includes("alloy")) {
    return { detune: -100, playbackRate: 0.96, bassGain: 3, trebleGain: 0 };
  }
  // Nữ điềm tĩnh nhẹ nhàng (Shiori)
  if (v.includes("shiori")) {
    return { detune: -150, playbackRate: 0.92, bassGain: 2, trebleGain: -1 };
  }
  // Google chậm
  if (v.includes("slow")) {
    return { detune: 0, playbackRate: 0.82 };
  }
  // Nữ chuẩn (Nanami, Google chuẩn)
  return { detune: 0, playbackRate: 1.0 };
}

/**
 * Connects an AudioBufferSourceNode to destination through acoustic DSP filters (pitch + EQ).
 */
export function applyVoiceDsp(
  ctx: AudioContext,
  source: AudioBufferSourceNode,
  profile: VoiceDspProfile,
  destination: AudioNode = ctx.destination
): AudioNode {
  // 1. Pitch / Detune in cents (-100 cents = 1 semitone)
  if (typeof source.detune !== "undefined" && profile.detune) {
    try {
      source.detune.value = profile.detune;
    } catch {}
  }

  // 2. Playback speed
  source.playbackRate.value = profile.playbackRate || 1.0;

  let currentNode: AudioNode = source;

  // 3. Low-shelf filter for chest / body resonance (especially male)
  if (profile.bassGain) {
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 220;
    bass.gain.value = profile.bassGain;
    currentNode.connect(bass);
    currentNode = bass;
  }

  // 4. Treble filter (clarity / brightness or de-harshing)
  if (profile.trebleGain) {
    const treble = ctx.createBiquadFilter();
    treble.type = "peaking";
    treble.frequency.value = 2800;
    treble.gain.value = profile.trebleGain;
    currentNode.connect(treble);
    currentNode = treble;
  }

  currentNode.connect(destination);
  return currentNode;
}
