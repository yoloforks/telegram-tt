import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAttachBot } from '../../../api/types';
import type { IAnchorPosition, ISettings } from '../../../types';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import Portal from '../../ui/Portal';
import AttachBotIcon from './AttachBotIcon';

type OwnProps = {
  bot: ApiAttachBot;
  theme: ISettings['theme'];
  chatId: string;
  threadId?: number;
  onMenuOpened: VoidFunction;
  onMenuClosed: VoidFunction;
};

const AttachBotItem: FC<OwnProps> = ({
  bot,
  theme,
  chatId,
  threadId,
  onMenuOpened,
  onMenuClosed,
}) => {
  const { callAttachBot, toggleAttachBot } = getActions();

  const lang = useLang();

  const icon = useMemo(() => {
    return bot.icons.find(({ name }) => name === 'default_static')?.document;
  }, [bot.icons]);

  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const handleContextMenu = useLastCallback((e: React.UIEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ x: rect.right, y: rect.bottom });
    onMenuOpened();
    openMenu();
  });

  const handleCloseMenu = useLastCallback(() => {
    closeMenu();
    onMenuClosed();
  });

  const handleCloseAnimationEnd = useLastCallback(() => {
    setMenuPosition(undefined);
  });

  const handleRemoveBot = useLastCallback(() => {
    toggleAttachBot({
      botId: bot.id,
      isEnabled: false,
    });
  });

  return (
    <MenuItem
      key={bot.id}
      customIcon={icon && <AttachBotIcon icon={icon} theme={theme} />}
      icon={!icon ? 'bots' : undefined}
      // eslint-disable-next-line react/jsx-no-bind
      onClick={() => callAttachBot({
        bot,
        chatId,
        threadId,
      })}
      onContextMenu={handleContextMenu}
    >
      {bot.shortName}
      {menuPosition && (
        <Portal>
          <Menu
            isOpen={isMenuOpen}
            positionX="right"
            style={`left: ${menuPosition.x}px;top: ${menuPosition.y}px;`}
            className="bot-attach-context-menu"
            autoClose
            onClose={handleCloseMenu}
            onCloseAnimationEnd={handleCloseAnimationEnd}
          >
            <MenuItem icon="stop" destructive onClick={handleRemoveBot}>{lang('WebApp.RemoveBot')}</MenuItem>
          </Menu>
        </Portal>
      )}

    </MenuItem>
  );
};

export default memo(AttachBotItem);
