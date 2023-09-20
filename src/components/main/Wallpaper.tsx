import React from '../../lib/teact/teact';
import { type FC, useEffect, useRef } from '../../lib/teact/teact';

import type { TwallpaperOptions } from '../../lib/twallpaper';
import type { ThemeKey } from '../../types';

import { Twallpaper } from '../../lib/twallpaper';

import './Wallpaper.scss';

type StateProps = {
  theme: ThemeKey;
};

const Wallpaper: FC<StateProps> = ({
  theme,
}) => {
  const wallpaperOptions = useRef<TwallpaperOptions>({
    colors: [
      // '#dbddbb',
      // '#6ba587',
      // '#d5d88d',
      // '#88b884',
      '#fec496',
      '#dd6cb9',
      '#962fbf',
      '#4f5bd5',
    ],
    mask: {
      enabled: true,
      image: 'animals',
      color: '#000000',
    },
  });

  // eslint-disable-next-line no-null/no-null
  const twallpaperRef = useRef<Twallpaper>(null);
  // eslint-disable-next-line no-null/no-null
  const twallpaperContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!twallpaperContainerRef.current) return;
    twallpaperRef.current = new Twallpaper(twallpaperContainerRef.current!);
    twallpaperRef.current.init(wallpaperOptions.current);
  }, []);

  useEffect(() => {
    wallpaperOptions.current.mask.enabled = theme === 'dark';
    twallpaperRef.current!.setOptions(wallpaperOptions.current);
    twallpaperRef.current!.updateMask();
  }, [theme]);

  return <div ref={twallpaperContainerRef} />;
};

export default Wallpaper;
