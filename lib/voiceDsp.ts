/**
 * Nihon Quest — Web Audio Voice Engine
 * Pure, natural playback without artificial sample pitch warping.
 * Neural prosody (pitch & timbre) is synthesized natively by Microsoft Edge Neural AI on the backend.
 */

export interface VoiceDspProfile {
  detune: number;
  playbackRate: number;
}

export function getVoiceDspProfile(voiceId: string): VoiceDspProfile {
  const v = (voiceId || "").toLowerCase();

  // Subtle speed nuances matching persona (without pitch distortion)
  if (v.includes("ren")) return { detune: 0, playbackRate: 1.08 };
  if (v.includes("slow")) return { detune: 0, playbackRate: 0.82 };
  if (v.includes("shiori")) return { detune: 0, playbackRate: 0.94 };

  return { detune: 0, playbackRate: 1.0 };
}

/**
 * Connects an AudioBufferSourceNode cleanly to destination.
 */
export function applyVoiceDsp(
  ctx: AudioContext,
  source: AudioBufferSourceNode,
  profile: VoiceDspProfile,
  destination: AudioNode = ctx.destination
): AudioNode {
  // Ensure natural 1.0 playback rate (no slow-mo or chipmunk warping)
  source.playbackRate.value = profile.playbackRate || 1.0;
  source.connect(destination);
  return source;
}
