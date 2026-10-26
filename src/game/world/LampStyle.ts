// ─── LampStyle: runtime night-lamp palettes (halogen ⇄ xenon) ────────────────
// The shipped look is warm halogen (matches CarModelLoader.HEAD_EMISSIVE and
// the beam constants Car.attachHeadlightsAndLabel builds with). Xenon is the
// HID alternative: cool 6000K blue-white lens tint, a tighter projector cone
// with a longer throw. Car.setHeadStyle swaps the whole fleet live (lens
// emissive tint/intensity + SpotLight params + rival cone tint) — no rebuild,
// so compare screenshots never mix styles inside one frame.
import * as THREE from "three";
import { LAMP_HEAD_INTENSITY } from "./CarModelLoader";

export type HeadlampStyle = "halogen" | "xenon";

export interface HeadlampPalette {
  /** lens emissive tint (raw linear triple, same convention as HEAD_EMISSIVE) */
  lens: THREE.Color;
  /** lens emissiveIntensity at night */
  lensIntensity: number;
  /** player SpotLight params — see attachHeadlightsAndLabel for the meaning */
  beamColor: number;
  beamIntensity: number;
  beamDistance: number;
  beamAngle: number;
  beamPenumbra: number;
  /** rival fake-beam cone tint */
  coneColor: number;
  /** per-frame forced beam intensity (Car.syncVisual's legacy "hot beams"
   * tune follows the active style) */
  syncIntensity: number;
}

/** warm halogen — the shipped look, byte-for-byte the same values the
 *  constructors build with (swapping back must be a true no-op visually) */
export const HALOGEN: HeadlampPalette = {
  lens: new THREE.Color(1, 0.93, 0.72),
  lensIntensity: LAMP_HEAD_INTENSITY,
  beamColor: 0xfff0c8,
  beamIntensity: 90,
  beamDistance: 90,
  beamAngle: 0.45,
  beamPenumbra: 0.55,
  coneColor: 0xfff0c0,
  syncIntensity: 95, // the pre-style-swap hardcoded value — byte-identical look
};

/** xenon HID — cool 6000K blue-white; hotter lens, narrower projector cone
 *  with a sharper cutoff and a longer throw */
export const XENON: HeadlampPalette = {
  lens: new THREE.Color(0.78, 0.87, 1.0),
  lensIntensity: 3.0,
  beamColor: 0xd8e9ff,
  beamIntensity: 100,
  beamDistance: 105,
  beamAngle: 0.35,
  beamPenumbra: 0.4,
  coneColor: 0xcfe2ff,
  syncIntensity: 105, // hotter HID throw
};

export function headPalette(style: HeadlampStyle): HeadlampPalette {
  return style === "xenon" ? XENON : HALOGEN;
}
