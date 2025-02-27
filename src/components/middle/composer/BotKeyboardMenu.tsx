import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { selectChatMessage, selectCurrentMessageList } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useMouseInside from '../../../hooks/useMouseInside';

import Button from '../../ui/Button';
import Menu from '../../ui/Menu';

import './BotKeyboardMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  messageId: number;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  message?: ApiMessage;
};

const BotKeyboardMenu: FC<OwnProps & StateProps> = ({
  isOpen, message, onClose,
}) => {
  const { clickBotInlineButton } = getActions();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const { isKeyboardSingleUse } = message || {};

  if (!message || !message.keyboardButtons) {
    return undefined;
  }

  return (
    <Menu
      isOpen={isOpen}
      autoClose={isKeyboardSingleUse}
      positionX="right"
      positionY="bottom"
      onClose={onClose}
      className="BotKeyboardMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCompact
    >
      <div className="content">
        {message.keyboardButtons.map((row) => (
          <div className="row">
            {row.map((button) => (
              <Button
                ripple
                disabled={button.type === 'unsupported'}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => clickBotInlineButton({ messageId: message.id, button })}
              >
                {button.text}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { messageId }): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    if (!chatId) {
      return {};
    }

    return { message: selectChatMessage(global, chatId, messageId) };
  },
)(BotKeyboardMenu));
