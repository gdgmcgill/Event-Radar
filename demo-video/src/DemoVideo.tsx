import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { COLORS } from "./styles/colors";

import { LogoIntro } from "./scenes/LogoIntro";
import { Discover } from "./scenes/Discover";
import { Filter } from "./scenes/Filter";
import { Explore } from "./scenes/Explore";
import { Plan } from "./scenes/Plan";
import { Save } from "./scenes/Save";
import { FlashCuts } from "./scenes/FlashCuts";
import { Outro } from "./scenes/Outro";

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.background }}>
      {/* Beat 1: Logo Intro (0-3s) */}
      <Sequence from={0} durationInFrames={90}>
        <LogoIntro />
      </Sequence>

      {/* Beat 2: Discover (3-7s) */}
      <Sequence from={90} durationInFrames={120}>
        <Discover />
      </Sequence>

      {/* Beat 3: Filter (7-11s) */}
      <Sequence from={210} durationInFrames={120}>
        <Filter />
      </Sequence>

      {/* Beat 4: Explore (11-15s) */}
      <Sequence from={330} durationInFrames={120}>
        <Explore />
      </Sequence>

      {/* Beat 5: Plan (15-19s) */}
      <Sequence from={450} durationInFrames={120}>
        <Plan />
      </Sequence>

      {/* Beat 6: Save (19-23s) */}
      <Sequence from={570} durationInFrames={120}>
        <Save />
      </Sequence>

      {/* Beat 7: Flash Cuts (23-27s) */}
      <Sequence from={690} durationInFrames={120}>
        <FlashCuts />
      </Sequence>

      {/* Beat 8: Outro (27-30s) */}
      <Sequence from={810} durationInFrames={90}>
        <Outro />
      </Sequence>

      {/* === SFX Audio Layers === */}

      {/* Beat 1: Deep whoosh + impact */}
      <Sequence from={20}>
        <Audio src={staticFile("sfx/whoosh-deep.mp3")} volume={0.8} />
      </Sequence>
      <Sequence from={30}>
        <Audio src={staticFile("sfx/impact-hit.mp3")} volume={0.9} />
      </Sequence>

      {/* Beat 2: Swoosh + keyboard clicks + snap */}
      <Sequence from={90}>
        <Audio src={staticFile("sfx/swoosh-airy.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={115}>
        <Audio src={staticFile("sfx/keyboard-click.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={180}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 3: Glass taps + shuffle + snap */}
      <Sequence from={240}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={252}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={264}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={280}>
        <Audio src={staticFile("sfx/card-shuffle.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={300}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 4: Pop + modal slide + snap */}
      <Sequence from={330}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={390}>
        <Audio src={staticFile("sfx/modal-slide.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={420}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 5: Rapid ticks + chime + snap */}
      <Sequence from={480}>
        <Audio src={staticFile("sfx/tick-rapid.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={520}>
        <Audio src={staticFile("sfx/chime.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={540}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 6: Heartbeat + whoosh + snap */}
      <Sequence from={600}>
        <Audio src={staticFile("sfx/heartbeat-thump.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={620}>
        <Audio src={staticFile("sfx/swoosh-airy.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={650}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 7: Shutter clicks + impact */}
      <Sequence from={690}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={720}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={750}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={780}>
        <Audio src={staticFile("sfx/impact-hit.mp3")} volume={1.0} />
      </Sequence>

      {/* Beat 8: Final impact */}
      <Sequence from={820}>
        <Audio src={staticFile("sfx/impact-final.mp3")} volume={1.0} />
      </Sequence>
    </AbsoluteFill>
  );
};
