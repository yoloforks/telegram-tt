import type { API_CHAT_TYPES } from '../../config';
import type { ApiBotInfo } from './bots';
import type { ApiDocument, ApiPhoto } from './messages';

export interface ApiUser {
  id: string;
  isMin: boolean;
  isSelf?: true;
  isVerified?: true;
  isPremium?: boolean;
  isCloseFriend?: boolean;
  isContact?: true;
  isSupport?: true;
  type: ApiUserType;
  firstName?: string;
  lastName?: string;
  noStatus?: boolean;
  usernames?: ApiUsername[];
  phoneNumber: string;
  accessHash?: string;
  hasVideoAvatar?: boolean;
  avatarHash?: string;
  photos?: ApiPhoto[];
  botPlaceholder?: string;
  canBeInvitedToGroup?: boolean;
  commonChats?: {
    ids: string[];
    maxId: string;
    isFullyLoaded: boolean;
  };
  fakeType?: ApiFakeType;
  isAttachBot?: boolean;
  emojiStatus?: ApiEmojiStatus;
  areStoriesHidden?: boolean;
  hasStories?: boolean;
  hasUnreadStories?: boolean;
  maxStoryId?: number;
}

export interface ApiUserFullInfo {
  isBlocked?: boolean;
  bio?: string;
  commonChatsCount?: number;
  pinnedMessageId?: number;
  botInfo?: ApiBotInfo;
  profilePhoto?: ApiPhoto;
  fallbackPhoto?: ApiPhoto;
  personalPhoto?: ApiPhoto;
  noVoiceMessages?: boolean;
  premiumGifts?: ApiPremiumGiftOption[];
  isTranslationDisabled?: true;
  hasPinnedStories?: boolean;
}

export type ApiFakeType = 'fake' | 'scam';

export type ApiUserType = 'userTypeBot' | 'userTypeRegular' | 'userTypeDeleted' | 'userTypeUnknown';

export interface ApiUserStatus {
  type: (
    'userStatusEmpty' | 'userStatusLastMonth' | 'userStatusLastWeek' |
    'userStatusOffline' | 'userStatusOnline' | 'userStatusRecently'
  );
  wasOnline?: number;
  expires?: number;
}

export interface ApiUsername {
  username: string;
  isActive?: boolean;
  isEditable?: boolean;
}

export type ApiChatType = typeof API_CHAT_TYPES[number];
export type ApiAttachMenuPeerType = 'self' | ApiChatType;

export interface ApiAttachBot {
  id: string;
  hasSettings?: boolean;
  shouldRequestWriteAccess?: boolean;
  shortName: string;
  peerTypes: ApiAttachMenuPeerType[];
  icons: ApiAttachBotIcon[];
}

export interface ApiAttachBotIcon {
  name: string;
  document: ApiDocument;
}

export interface ApiPremiumGiftOption {
  months: number;
  currency: string;
  amount: number;
  botUrl: string;
}

export interface ApiEmojiStatus {
  documentId: string;
  until?: number;
}
