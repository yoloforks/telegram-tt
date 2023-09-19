import React from '../lib/teact/teact';
import { type FC, useEffect, useRef } from '../lib/teact/teact';
import { withGlobal } from '../global';

import type { TwallpaperOptions } from '../lib/twallpaper';
import type { ThemeKey } from '../types';

import { Twallpaper } from '../lib/twallpaper';
import { selectTheme } from '../global/selectors/ui';

import '../lib/twallpaper/twallpaper.scss';

type StateProps = {
  theme: ThemeKey;
};

const Wallpaper: FC<StateProps> = ({
  theme,
}) => {
  const wallpaperOptions = useRef<TwallpaperOptions>({
    colors: [
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
    if (!twallpaperRef.current) return;

    if (theme === 'dark') {
      wallpaperOptions.current.mask.enabled = true;
    } else {
      wallpaperOptions.current.mask.enabled = false;
    }

    twallpaperRef.current.setOptions(wallpaperOptions.current);
    twallpaperRef.current.updateMask();
  }, [theme]);

  return <div ref={twallpaperContainerRef} />;
};

export default Wallpaper;
