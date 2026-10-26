import { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationBlock, AudioBlock } from './doc';
import type { BlockContext } from './context';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AudioView({ block, ctx }: { block: AudioBlock; ctx: BlockContext }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  if (!block.src) return <div className="cp-empty">Audio</div>;

  const toggle = () => {
    const a = audio.current;
    if (!a || ctx.edit) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const background = block.mode === 'background';

  return (
    <div className={background ? 'cp-audio cp-audio-bg' : 'cp-audio'}>
      <audio
        ref={audio}
        src={block.src}
        preload="metadata"
        loop={background}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          ctx.audioProgress(block.id, t);
        }}
        onEnded={() => {
          ctx.audioProgress(block.id, Number.MAX_SAFE_INTEGER);
          ctx.mediaEnded(block.id);
        }}
      />
      <button
        type="button"
        className="cp-audio-btn"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {background ? (playing ? 'Sound on' : 'Sound off') : playing ? 'Pause' : 'Play'}
      </button>
      {!background && (
        <>
          <div className="cp-prog cp-audio-prog">
            <i style={{ width: duration ? `${(time / duration) * 100}%` : '0%' }} />
          </div>
          <span className="cp-count">
            {clock(time)} / {clock(duration)}
          </span>
        </>
      )}
    </div>
  );
}

export function AnimationView({ block }: { block: AnimationBlock }) {
  const box = useRef<HTMLDivElement>(null);
  const lottieFile = block.src.toLowerCase().endsWith('.json');

  useEffect(() => {
    if (!lottieFile || !box.current) return;
    const anim = lottie.loadAnimation({
      container: box.current,
      renderer: 'svg',
      loop: block.loop,
      autoplay: true,
      path: block.src,
    });
    return () => anim.destroy();
  }, [block.src, block.loop, lottieFile]);

  if (!block.src) return <div className="cp-empty">Animation</div>;
  if (lottieFile) return <div ref={box} className="cp-lottie" />;
  return <img className="cp-img cp-img-full" src={block.src} alt="" />;
}
