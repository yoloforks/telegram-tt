import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiPhoto, ApiUser } from '../../../api/types';
import type { ApiPrivacySettings } from '../../../types';
import { SettingsScreens } from '../../../types';

import { selectUserFullInfo } from '../../../global/selectors';
import { getPrivacyKey } from './helpers/privacy';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import SettingsPrivacyPublicProfilePhoto from './SettingsPrivacyPublicProfilePhoto';

type OwnProps = {
  screen: SettingsScreens;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps =
  Partial<ApiPrivacySettings> & {
    chatsById?: Record<string, ApiChat>;
    usersById?: Record<string, ApiUser>;
    currentUserId: string;
    hasCurrentUserFullInfo?: boolean;
    currentUserFallbackPhoto?: ApiPhoto;
  };

const SettingsPrivacyVisibility: FC<OwnProps & StateProps> = ({
  screen,
  isActive,
  onScreenSelect,
  onReset,
  visibility,
  allowUserIds,
  allowChatIds,
  blockUserIds,
  blockChatIds,
  chatsById,
  currentUserId,
  hasCurrentUserFullInfo,
  currentUserFallbackPhoto,
}) => {
  const { setPrivacyVisibility } = getActions();

  const lang = useLang();

  const visibilityOptions = useMemo(() => {
    return [
      { value: 'everybody', label: lang('P2PEverybody') },
      { value: 'contacts', label: lang('P2PContacts') },
      { value: 'nobody', label: lang('P2PNobody') },
    ];
  }, [lang]);

  const exceptionLists = {
    shouldShowDenied: visibility !== 'nobody',
    shouldShowAllowed: visibility !== 'everybody',
  };

  const privacyKey = getPrivacyKey(screen);

  const headerText = useMemo(() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return lang('PrivacyPhoneTitle');
      case SettingsScreens.PrivacyLastSeen:
        return lang('LastSeenTitle');
      case SettingsScreens.PrivacyProfilePhoto:
        return lang('PrivacyProfilePhotoTitle');
      case SettingsScreens.PrivacyForwarding:
        return lang('PrivacyForwardsTitle');
      case SettingsScreens.PrivacyVoiceMessages:
        return lang('PrivacyVoiceMessagesTitle');
      case SettingsScreens.PrivacyGroupChats:
        return lang('WhoCanAddMe');
      case SettingsScreens.PrivacyPhoneCall:
        return lang('WhoCanCallMe');
      case SettingsScreens.PrivacyPhoneP2P:
        return lang('PrivacyP2P');
      default:
        return undefined;
    }
  }, [lang, screen]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const descriptionText = useMemo(() => {
    switch (screen) {
      case SettingsScreens.PrivacyLastSeen:
        return lang('CustomHelp');
      default:
        return undefined;
    }
  }, [lang, screen]);

  const allowedContactsScreen = (() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return SettingsScreens.PrivacyPhoneNumberAllowedContacts;
      case SettingsScreens.PrivacyLastSeen:
        return SettingsScreens.PrivacyLastSeenAllowedContacts;
      case SettingsScreens.PrivacyProfilePhoto:
        return SettingsScreens.PrivacyProfilePhotoAllowedContacts;
      case SettingsScreens.PrivacyForwarding:
        return SettingsScreens.PrivacyForwardingAllowedContacts;
      case SettingsScreens.PrivacyPhoneCall:
        return SettingsScreens.PrivacyPhoneCallAllowedContacts;
      case SettingsScreens.PrivacyPhoneP2P:
        return SettingsScreens.PrivacyPhoneP2PAllowedContacts;
      case SettingsScreens.PrivacyVoiceMessages:
        return SettingsScreens.PrivacyVoiceMessagesAllowedContacts;
      default:
        return SettingsScreens.PrivacyGroupChatsAllowedContacts;
    }
  })();

  const deniedContactsScreen = (() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return SettingsScreens.PrivacyPhoneNumberDeniedContacts;
      case SettingsScreens.PrivacyLastSeen:
        return SettingsScreens.PrivacyLastSeenDeniedContacts;
      case SettingsScreens.PrivacyProfilePhoto:
        return SettingsScreens.PrivacyProfilePhotoDeniedContacts;
      case SettingsScreens.PrivacyForwarding:
        return SettingsScreens.PrivacyForwardingDeniedContacts;
      case SettingsScreens.PrivacyPhoneCall:
        return SettingsScreens.PrivacyPhoneCallDeniedContacts;
      case SettingsScreens.PrivacyPhoneP2P:
        return SettingsScreens.PrivacyPhoneP2PDeniedContacts;
      case SettingsScreens.PrivacyVoiceMessages:
        return SettingsScreens.PrivacyVoiceMessagesDeniedContacts;
      default:
        return SettingsScreens.PrivacyGroupChatsDeniedContacts;
    }
  })();

  const allowedCount = useMemo(() => {
    if (!allowUserIds || !allowChatIds || !chatsById) {
      return 0;
    }

    return allowChatIds.reduce((result, chatId) => {
      return result + (chatsById[chatId] ? chatsById[chatId].membersCount! : 0);
    }, allowUserIds.length);
  }, [allowChatIds, allowUserIds, chatsById]);

  const blockCount = useMemo(() => {
    if (!blockUserIds || !blockChatIds || !chatsById) {
      return 0;
    }

    return blockChatIds.reduce((result, chatId) => {
      return result + (chatsById[chatId] ? chatsById[chatId].membersCount! : 0);
    }, blockUserIds.length);
  }, [blockChatIds, blockUserIds, chatsById]);

  const handleVisibilityChange = useCallback((value) => {
    setPrivacyVisibility({
      privacyKey: privacyKey!,
      visibility: value,
    });
  }, [privacyKey, setPrivacyVisibility]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{headerText}</h4>

        <RadioGroup
          name={`visibility-${privacyKey}`}
          options={visibilityOptions}
          onChange={handleVisibilityChange}
          selected={visibility}
        />

        {descriptionText && (
          <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>{descriptionText}</p>
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>{lang('PrivacyExceptions')}</h4>

        {exceptionLists.shouldShowAllowed && (
          <ListItem
            narrow
            icon="add-user"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => {
              onScreenSelect(allowedContactsScreen);
            }}
          >
            <div className="multiline-menu-item full-size">
              {allowedCount > 0 && <span className="date" dir="auto">+{allowedCount}</span>}
              <span className="title">{lang('AlwaysAllow')}</span>
              <span className="subtitle">{lang('EditAdminAddUsers')}</span>
            </div>
          </ListItem>
        )}
        {exceptionLists.shouldShowDenied && (
          <ListItem
            narrow
            icon="delete-user"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => {
              onScreenSelect(deniedContactsScreen);
            }}
          >
            <div className="multiline-menu-item full-size">
              {blockCount > 0 && <span className="date" dir="auto">&minus;{blockCount}</span>}
              <span className="title">{lang('NeverAllow')}</span>
              <span className="subtitle">{lang('EditAdminAddUsers')}</span>
            </div>
          </ListItem>
        )}
      </div>

      {screen === SettingsScreens.PrivacyProfilePhoto && exceptionLists.shouldShowAllowed && (
        <SettingsPrivacyPublicProfilePhoto
          currentUserId={currentUserId}
          hasCurrentUserFullInfo={hasCurrentUserFullInfo}
          currentUserFallbackPhoto={currentUserFallbackPhoto}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { screen }): StateProps => {
    let privacySettings: ApiPrivacySettings | undefined;

    const {
      currentUserId,
      chats: { byId: chatsById },
      settings: { privacy },
    } = global;

    const currentUserFullInfo = selectUserFullInfo(global, currentUserId!);

    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        privacySettings = privacy.phoneNumber;
        break;

      case SettingsScreens.PrivacyLastSeen:
        privacySettings = privacy.lastSeen;
        break;

      case SettingsScreens.PrivacyProfilePhoto:
        privacySettings = privacy.profilePhoto;
        break;

      case SettingsScreens.PrivacyPhoneCall:
        privacySettings = privacy.phoneCall;
        break;

      case SettingsScreens.PrivacyPhoneP2P:
        privacySettings = privacy.phoneP2P;
        break;

      case SettingsScreens.PrivacyForwarding:
        privacySettings = privacy.forwards;
        break;

      case SettingsScreens.PrivacyVoiceMessages:
        privacySettings = privacy.voiceMessages;
        break;

      case SettingsScreens.PrivacyGroupChats:
        privacySettings = privacy.chatInvite;
        break;
    }

    if (!privacySettings) {
      return {
        currentUserId: currentUserId!,
        hasCurrentUserFullInfo: Boolean(currentUserFullInfo),
        currentUserFallbackPhoto: currentUserFullInfo?.fallbackPhoto,
      };
    }

    return {
      ...privacySettings,
      chatsById,
      currentUserId: currentUserId!,
      hasCurrentUserFullInfo: Boolean(currentUserFullInfo),
      currentUserFallbackPhoto: currentUserFullInfo?.fallbackPhoto,
    };
  },
)(SettingsPrivacyVisibility));
