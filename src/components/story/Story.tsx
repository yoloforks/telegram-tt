import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiStealthMode, ApiStory, ApiTypeStory, ApiUser,
} from '../../api/types';
import type { IDimensions } from '../../global/types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import { EDITABLE_STORY_INPUT_CSS_SELECTOR, EDITABLE_STORY_INPUT_ID } from '../../config';
import { getUserFirstOrLastName } from '../../global/helpers';
import {
  selectChat, selectIsCurrentUserPremium,
  selectTabState, selectUserStories, selectUserStory,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { formatMediaDuration, formatRelativeTime } from '../../util/dateFormat';
import download from '../../util/download';
import { getServerTime } from '../../util/serverTime';
import renderText from '../common/helpers/renderText';

import useUnsupportedMedia from '../../hooks/media/useUnsupportedMedia';
import useAppLayout, { getIsMobile } from '../../hooks/useAppLayout';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLongPress from '../../hooks/useLongPress';
import useMediaTransition from '../../hooks/useMediaTransition';
import useShowTransition from '../../hooks/useShowTransition';
import useStoryPreloader from './hooks/useStoryPreloader';
import useStoryProps from './hooks/useStoryProps';

import Avatar from '../common/Avatar';
import AvatarList from '../common/AvatarList';
import Composer from '../common/Composer';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';
import Skeleton from '../ui/placeholder/Skeleton';
import MediaAreaOverlay from './MediaAreaOverlay';
import StoryCaption from './StoryCaption';
import StoryProgress from './StoryProgress';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  userId: string;
  storyId: number;
  dimensions: IDimensions;
  // eslint-disable-next-line react/no-unused-prop-types
  isReportModalOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  isDeleteModalOpen?: boolean;
  isPrivateStories?: boolean;
  isArchivedStories?: boolean;
  isSingleStory?: boolean;
  getIsAnimating: Signal<boolean>;
  onDelete: (storyId: number) => void;
  onClose: NoneToVoidFunction;
  onReport: NoneToVoidFunction;
}

interface StateProps {
  user: ApiUser;
  story?: ApiTypeStory;
  isMuted: boolean;
  isSelf: boolean;
  orderedIds?: number[];
  shouldForcePause?: boolean;
  storyChangelogUserId?: string;
  viewersExpirePeriod: number;
  isChatExist?: boolean;
  areChatSettingsLoaded?: boolean;
  isCurrentUserPremium?: boolean;
  stealthMode: ApiStealthMode;
}

const VIDEO_MIN_READY_STATE = 4;
const SPACEBAR_CODE = 32;

const PRIMARY_VIDEO_MIME = 'video/mp4; codecs=hvc1.1.6.L63.00';
const SECONDARY_VIDEO_MIME = 'video/mp4; codecs=avc1.64001E';

const STEALTH_MODE_NOTIFICATION_DURATION = 4000;

function Story({
  isSelf,
  userId,
  storyId,
  user,
  isMuted,
  isArchivedStories,
  isPrivateStories,
  story,
  orderedIds,
  isSingleStory,
  dimensions,
  shouldForcePause,
  storyChangelogUserId,
  viewersExpirePeriod,
  isChatExist,
  areChatSettingsLoaded,
  getIsAnimating,
  isCurrentUserPremium,
  stealthMode,
  onDelete,
  onClose,
  onReport,
}: OwnProps & StateProps) {
  const {
    viewStory,
    setStoryViewerMuted,
    openPreviousStory,
    openNextStory,
    loadUserSkippedStories,
    openForwardMenu,
    openStoryViewModal,
    copyStoryLink,
    toggleStoryPinned,
    openChat,
    showNotification,
    openStoryPrivacyEditor,
    loadChatSettings,
    fetchChat,
    loadStoryViews,
    toggleStealthModal,
  } = getActions();
  const serverTime = getServerTime();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const [, setCurrentTime] = useCurrentTimeSignal();
  const [isComposerHasFocus, markComposerHasFocus, unmarkComposerHasFocus] = useFlag(false);
  const [isStoryPlaybackRequested, playStory, pauseStory] = useFlag(false);
  const [isStoryPlaying, markStoryPlaying, unmarkStoryPlaying] = useFlag(false);
  const [isAppFocused, markAppFocused, unmarkAppFocused] = useFlag(true);
  const [isCaptionExpanded, expandCaption, foldCaption] = useFlag(false);
  const [isPausedBySpacebar, setIsPausedBySpacebar] = useState(false);
  const [isPausedByLongPress, markIsPausedByLongPress, unmarkIsPausedByLongPress] = useFlag(false);
  const [isDropdownMenuOpen, markDropdownMenuOpen, unmarkDropdownMenuOpen] = useFlag(false);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isDeletedStory,
    hasText,
    thumbnail,
    previewBlobUrl,
    isVideo,
    noSound,
    fullMediaData,
    altMediaHash,
    altMediaData,
    hasFullData,
    hasThumb,
    mediaAreas,
    canDownload,
    downloadMediaData,
  } = useStoryProps(story, isCurrentUserPremium, isDropdownMenuOpen);

  const isLoadedStory = story && 'content' in story;

  const isChangelog = userId === storyChangelogUserId;

  const canPinToProfile = useCurrentOrPrev(
    isSelf && isLoadedStory ? !story.isPinned : undefined,
    true,
  );
  const canUnpinFromProfile = useCurrentOrPrev(
    isSelf && isLoadedStory ? story.isPinned : undefined,
    true,
  );
  const areViewsExpired = Boolean(
    isSelf && isLoadedStory && (story!.date + viewersExpirePeriod) < getServerTime(),
  );
  const canCopyLink = Boolean(
    isLoadedStory
    && story.isPublic
    && !isChangelog
    && user?.usernames?.length,
  );

  const canShare = Boolean(
    isLoadedStory
    && story.isPublic
    && !story.noForwards
    && !isChangelog
    && !isCaptionExpanded,
  );
  const canShareOwn = Boolean(
    isSelf
    && isLoadedStory
    && story.isPublic
    && !story.noForwards,
  );

  const canPlayStory = Boolean(
    hasFullData && !shouldForcePause && isAppFocused && !isComposerHasFocus && !isCaptionExpanded
    && !isPausedBySpacebar && !isPausedByLongPress,
  );

  const {
    shouldRender: shouldRenderSkeleton, transitionClassNames: skeletonTransitionClassNames,
  } = useShowTransition(!hasFullData);

  const {
    transitionClassNames: mediaTransitionClassNames,
  } = useShowTransition(Boolean(fullMediaData));

  const thumbRef = useCanvasBlur(thumbnail, !hasThumb);
  const previewTransitionClassNames = useMediaTransition(previewBlobUrl);

  const {
    shouldRender: shouldRenderComposer,
    transitionClassNames: composerAppearanceAnimationClassNames,
  } = useShowTransition(!isSelf && !isChangelog);

  const {
    shouldRender: shouldRenderCaptionBackdrop,
    transitionClassNames: captionBackdropTransitionClassNames,
  } = useShowTransition(hasText && isCaptionExpanded);

  const { transitionClassNames: appearanceAnimationClassNames } = useShowTransition(true);

  useStoryPreloader(userId, storyId);

  useEffect(() => {
    if (storyId) {
      viewStory({ userId, storyId });
    }
  }, [storyId, userId]);

  useEffect(() => {
    loadUserSkippedStories({ userId });
  }, [userId]);

  // Fetching user privacy settings for use in Composer
  useEffect(() => {
    if (!isChatExist) {
      fetchChat({ chatId: userId });
    }
  }, [isChatExist, userId]);
  useEffect(() => {
    if (isChatExist && !areChatSettingsLoaded) {
      loadChatSettings({ chatId: userId });
    }
  }, [areChatSettingsLoaded, isChatExist, userId]);

  const handlePauseStory = useLastCallback(() => {
    if (isVideo) {
      videoRef.current?.pause();
    }

    unmarkStoryPlaying();
    pauseStory();
  });

  const handlePlayStory = useLastCallback(() => {
    if (!canPlayStory) return;

    playStory();
    if (!isVideo) markStoryPlaying();
  });

  const handleLongPressStart = useLastCallback(() => {
    markIsPausedByLongPress();
  });
  const handleLongPressEnd = useLastCallback(() => {
    unmarkIsPausedByLongPress();
  });

  const handleDropdownMenuOpen = useLastCallback(() => {
    markDropdownMenuOpen();
    handlePauseStory();
  });

  const handleDropdownMenuClose = useLastCallback(() => {
    unmarkDropdownMenuOpen();
    handlePlayStory();
  });

  const {
    onMouseDown: handleLongPressMouseDown,
    onMouseUp: handleLongPressMouseUp,
    onMouseLeave: handleLongPressMouseLeave,
    onTouchStart: handleLongPressTouchStart,
    onTouchEnd: handleLongPressTouchEnd,
  } = useLongPress(handleLongPressStart, handleLongPressEnd);

  const isUnsupported = useUnsupportedMedia(videoRef, undefined, !isVideo || !fullMediaData);

  const hasAllData = fullMediaData && (!altMediaHash || altMediaData);
  // Play story after media has been downloaded
  useEffect(() => { if (hasAllData && !isUnsupported) handlePlayStory(); }, [hasAllData, isUnsupported]);
  useBackgroundMode(unmarkAppFocused, markAppFocused);

  useEffect(() => {
    if (!hasAllData) return;
    videoRef.current?.load();
  }, [hasAllData]);

  useEffect(() => {
    if (!isSelf || isDeletedStory || areViewsExpired) return;

    // Refresh recent viewers list each time
    loadStoryViews({ storyId, isPreload: true });
  }, [isDeletedStory, areViewsExpired, isSelf, storyId]);

  useEffect(() => {
    if (
      shouldForcePause || !isAppFocused || isComposerHasFocus
      || isCaptionExpanded || isPausedBySpacebar || isPausedByLongPress
    ) {
      handlePauseStory();
    } else {
      handlePlayStory();
    }
  }, [
    handlePlayStory, isAppFocused, isCaptionExpanded, isComposerHasFocus,
    shouldForcePause, isPausedBySpacebar, isPausedByLongPress,
  ]);

  useEffect(() => {
    if (isComposerHasFocus || shouldForcePause || isCaptionExpanded) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.keyCode === SPACEBAR_CODE) {
        e.preventDefault();
        setIsPausedBySpacebar(!isPausedBySpacebar);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCaptionExpanded, isComposerHasFocus, isPausedBySpacebar, shouldForcePause]);

  // Reset the state of `isPausedBySpacebar` when closing the caption, losing focus by composer or disable forced pause
  useEffectWithPrevDeps(([
    prevIsComposerHasFocus,
    prevIsCaptionExpanded,
    prevShouldForcePause,
    prevIsAppFocused,
    prevIsPausedByLongPress,
  ]) => {
    if (
      !isPausedBySpacebar || isCaptionExpanded || isComposerHasFocus
      || shouldForcePause || !isAppFocused || isPausedByLongPress
    ) return;

    if (
      prevIsCaptionExpanded !== isCaptionExpanded
      || prevIsComposerHasFocus !== isComposerHasFocus
      || prevShouldForcePause !== shouldForcePause
      || prevIsAppFocused !== isAppFocused
      || prevIsPausedByLongPress !== isPausedByLongPress
    ) {
      setIsPausedBySpacebar(false);
    }
  }, [isComposerHasFocus, isCaptionExpanded, shouldForcePause, isAppFocused, isPausedByLongPress, isPausedBySpacebar]);

  const handleVideoStoryTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.readyState >= VIDEO_MIN_READY_STATE) {
      setCurrentTime(video.currentTime);
    }
  });

  const handleOpenChat = useLastCallback(() => {
    onClose();
    openChat({ id: userId });
  });

  const handleOpenPrevStory = useLastCallback(() => {
    setCurrentTime(0);
    openPreviousStory();
  });

  const handleOpenNextStory = useLastCallback(() => {
    setCurrentTime(0);
    openNextStory();
  });

  useEffect(() => {
    return !getIsAnimating() && !isComposerHasFocus ? captureKeyboardListeners({
      onRight: handleOpenNextStory,
      onLeft: handleOpenPrevStory,
    }) : undefined;
  }, [getIsAnimating, isComposerHasFocus]);

  const handleCopyStoryLink = useLastCallback(() => {
    copyStoryLink({ userId, storyId });
  });

  const handlePinClick = useLastCallback(() => {
    toggleStoryPinned({ storyId, isPinned: true });
  });

  const handleUnpinClick = useLastCallback(() => {
    toggleStoryPinned({ storyId, isPinned: false });
  });

  const handleDeleteStoryClick = useLastCallback(() => {
    setCurrentTime(0);
    onDelete(story!.id);
  });

  const handleReportStoryClick = useLastCallback(() => {
    onReport();
  });

  const handleForwardClick = useLastCallback(() => {
    openForwardMenu({ fromChatId: userId, storyId });
    handlePauseStory();
  });

  const handleOpenStoryViewModal = useLastCallback(() => {
    openStoryViewModal({ storyId });
  });

  const handleInfoPrivacyEdit = useLastCallback(() => {
    openStoryPrivacyEditor();
  });

  const handleInfoPrivacyClick = useLastCallback(() => {
    const visibility = !isLoadedStory || story.isPublic
      ? undefined
      : story.isForContacts ? 'contacts' : (story.isForCloseFriends ? 'closeFriends' : 'selectedContacts');

    let message;
    const myName = getUserFirstOrLastName(user);
    switch (visibility) {
      case 'selectedContacts':
        message = lang('StorySelectedContactsHint', myName);
        break;
      case 'contacts':
        message = lang('StoryContactsHint', myName);
        break;
      case 'closeFriends':
        message = lang('StoryCloseFriendsHint', myName);
        break;
      default:
        return;
    }
    showNotification({ message });
  });

  const handleVolumeMuted = useLastCallback(() => {
    if (noSound) {
      showNotification({
        message: lang('Story.TooltipVideoHasNoSound'),
      });
      return;
    }
    // Browser requires explicit user interaction to keep video playing after unmuting
    videoRef.current!.muted = !videoRef.current!.muted;
    setStoryViewerMuted({ isMuted: !isMuted });
  });

  const handleOpenStealthModal = useLastCallback(() => {
    if (stealthMode.activeUntil && getServerTime() < stealthMode.activeUntil) {
      const diff = stealthMode.activeUntil - getServerTime();
      showNotification({
        title: lang('StealthModeOn'),
        message: lang('Story.ToastStealthModeActiveText', formatMediaDuration(diff)),
        duration: STEALTH_MODE_NOTIFICATION_DURATION,
      });
      return;
    }

    toggleStealthModal({ isOpen: true });
  });

  const handleDownload = useLastCallback(() => {
    if (!downloadMediaData) return;
    download(downloadMediaData, `story-${userId}-${storyId}.${isVideo ? 'mp4' : 'jpg'}`);
  });

  useEffect(() => {
    if (!isDeletedStory) return;

    showNotification({
      message: lang('StoryNotFound'),
    });
  }, [lang, isDeletedStory]);

  const MenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => {
      return (
        <Button
          round
          ripple={!isMobile}
          size="tiny"
          color="translucent-white"
          className={isOpen ? 'active' : ''}
          onClick={onTrigger}
          ariaLabel={lang('AccDescrOpenMenu2')}
        >
          <i className={buildClassName('icon icon-more', styles.topIcon)} aria-hidden />
        </Button>
      );
    };
  }, [isMobile, lang]);

  function renderStoriesTabs() {
    const duration = isLoadedStory && story.content.video?.duration
      ? story.content.video.duration
      : undefined;

    return (
      <div className={styles.storyIndicators}>
        {(isSingleStory ? [storyId] : orderedIds ?? []).map((id) => (
          <StoryProgress
            key={`progress-${id}`}
            isActive={id === story?.id}
            isVideo={isVideo}
            isViewed={Boolean(story?.id && ((isPrivateStories || isArchivedStories) ? id > story?.id : id < story?.id))}
            isPaused={!isStoryPlaying}
            duration={duration}
            onImageComplete={handleOpenNextStory}
          />
        ))}
      </div>
    );
  }

  function renderStoryPrivacyButton() {
    let privacyIcon = 'channel-filled';
    const gradient: Record<string, [string, string]> = {
      'channel-filled': ['#50ABFF', '#007AFF'],
      'user-filled': ['#C36EFF', '#8B60FA'],
      'favorite-filled': ['#88D93A', '#30B73B'],
      'group-filled': ['#FFB743', '#F69A36'],
    };

    if (isSelf) {
      const { visibility } = (story && 'visibility' in story && story.visibility) || {};

      switch (visibility) {
        case 'everybody':
          privacyIcon = 'channel-filled';
          break;
        case 'contacts':
          privacyIcon = 'user-filled';
          break;
        case 'closeFriends':
          privacyIcon = 'favorite-filled';
          break;
        case 'selectedContacts':
          privacyIcon = 'group-filled';
      }
    } else {
      if (!story || !('content' in story) || story.isPublic) {
        return undefined;
      }

      privacyIcon = story.isForCloseFriends
        ? 'favorite-filled'
        : (story.isForContacts ? 'user-filled' : 'group-filled');
    }

    return (
      <div
        className={buildClassName(styles.visibilityButton, isSelf && styles.visibilityButtonSelf)}
        onClick={isSelf ? handleInfoPrivacyEdit : handleInfoPrivacyClick}
        style={`--color-from: ${gradient[privacyIcon][0]}; --color-to: ${gradient[privacyIcon][1]}`}
      >
        <i className={`icon icon-${privacyIcon}`} aria-hidden />
        {isSelf && <i className="icon icon-next" aria-hidden />}
      </div>
    );
  }

  function renderSender() {
    return (
      <div className={styles.sender}>
        <Avatar
          peer={user}
          size="tiny"
          onClick={handleOpenChat}
        />
        <div className={styles.senderInfo}>
          <span onClick={handleOpenChat} className={styles.senderName}>
            {renderText(getUserFirstOrLastName(user) || '')}
          </span>
          <div className={styles.storyMetaRow}>
            {story && 'date' in story && (
              <span className={styles.storyMeta}>{formatRelativeTime(lang, serverTime, story.date)}</span>
            )}
            {isLoadedStory && story.isEdited && (
              <span className={styles.storyMeta}>{lang('Story.HeaderEdited')}</span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {renderStoryPrivacyButton()}
          {isVideo && (
            <Button
              className={buildClassName(styles.button, styles.buttonVolume)}
              round
              ripple={!isMobile}
              size="tiny"
              color="translucent-white"
              disabled={!hasFullData}
              onClick={handleVolumeMuted}
              ariaLabel={lang('Volume')}
            >
              <i
                className={buildClassName(
                  'icon',
                  isMuted || noSound ? 'icon-speaker-muted-story' : 'icon-speaker-story',
                  styles.topIcon,
                )}
                aria-hidden
              />
            </Button>
          )}
          <DropdownMenu
            className={buildClassName(styles.button, styles.buttonMenu)}
            trigger={MenuButton}
            positionX="right"
            onOpen={handleDropdownMenuOpen}
            onClose={handleDropdownMenuClose}
          >
            {canCopyLink && <MenuItem icon="copy" onClick={handleCopyStoryLink}>{lang('CopyLink')}</MenuItem>}
            {canPinToProfile && (
              <MenuItem icon="save-story" onClick={handlePinClick}>{lang('StorySave')}</MenuItem>
            )}
            {canUnpinFromProfile && (
              <MenuItem icon="delete" onClick={handleUnpinClick}>{lang('ArchiveStory')}</MenuItem>
            )}
            {canDownload && (
              <MenuItem icon="download" disabled={!downloadMediaData} onClick={handleDownload}>
                {lang('lng_media_download')}
              </MenuItem>
            )}
            <MenuItem icon="eye-closed-outline" onClick={handleOpenStealthModal}>{lang('StealthMode')}</MenuItem>
            {!isSelf && <MenuItem icon="flag" onClick={handleReportStoryClick}>{lang('lng_report_story')}</MenuItem>}
            {isSelf && <MenuItem icon="delete" destructive onClick={handleDeleteStoryClick}>{lang('Delete')}</MenuItem>}
          </DropdownMenu>
        </div>
      </div>
    );
  }

  const recentViewers = useMemo(() => {
    const { users: { byId: usersById } } = getGlobal();

    const recentViewerIds = story && 'recentViewerIds' in story ? story.recentViewerIds : undefined;
    if (!recentViewerIds) return undefined;

    return recentViewerIds.map((id) => usersById[id]).filter(Boolean);
  }, [story]);

  function renderRecentViewers() {
    const { viewsCount, reactionsCount } = story as ApiStory;

    if (!viewsCount) {
      return (
        <div className={buildClassName(styles.recentViewers, appearanceAnimationClassNames)}>
          {lang('NobodyViewed')}
        </div>
      );
    }

    return (
      <div
        className={buildClassName(
          styles.recentViewers,
          styles.recentViewersInteractive,
          appearanceAnimationClassNames,
        )}
        onClick={handleOpenStoryViewModal}
      >
        {!areViewsExpired && Boolean(recentViewers?.length) && (
          <AvatarList
            size="small"
            peers={recentViewers}
            className={styles.recentViewersAvatars}
          />
        )}

        <span>{lang('Views', viewsCount, 'i')}</span>
        {Boolean(reactionsCount) && (
          <span className={styles.reactionCount}>
            <i className={buildClassName(styles.reactionCountHeart, 'icon icon-heart')} />
            {reactionsCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={buildClassName(styles.slideInner, 'component-theme-dark')}
      onMouseDown={handleLongPressMouseDown}
      onMouseUp={handleLongPressMouseUp}
      onMouseLeave={handleLongPressMouseLeave}
      onTouchStart={handleLongPressTouchStart}
      onTouchEnd={handleLongPressTouchEnd}
    >
      <div className={buildClassName(styles.storyHeader, appearanceAnimationClassNames)}>
        {renderStoriesTabs()}
        {renderSender()}
      </div>

      <div
        className={styles.mediaWrapper}
        style={`width: ${dimensions.width}px; height: ${dimensions.height}px`}
      >
        <canvas ref={thumbRef} className={styles.thumbnail} />
        {previewBlobUrl && (
          <img src={previewBlobUrl} alt="" className={buildClassName(styles.media, previewTransitionClassNames)} />
        )}
        {shouldRenderSkeleton && (
          <Skeleton className={buildClassName(skeletonTransitionClassNames, styles.fullSize)} />
        )}
        {!isVideo && fullMediaData && (
          <img
            src={fullMediaData}
            alt=""
            className={buildClassName(styles.media, mediaTransitionClassNames)}
            draggable={false}
          />
        )}
        {isVideo && fullMediaData && (
          <OptimizedVideo
            ref={videoRef}
            className={buildClassName(styles.media, mediaTransitionClassNames)}
            canPlay={isStoryPlaybackRequested}
            muted={isMuted}
            draggable={false}
            playsInline
            disablePictureInPicture
            isPriority
            onPlaying={markStoryPlaying}
            onPause={unmarkStoryPlaying}
            onWaiting={unmarkStoryPlaying}
            onTimeUpdate={handleVideoStoryTimeUpdate}
            onEnded={handleOpenNextStory}
          >
            <source src={fullMediaData} type={PRIMARY_VIDEO_MIME} width="720" />
            {altMediaData && <source src={altMediaData} type={SECONDARY_VIDEO_MIME} width="480" />}
          </OptimizedVideo>
        )}

        {!isPausedByLongPress && !isComposerHasFocus && (
          <>
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.prev)}
              onClick={handleOpenPrevStory}
              aria-label={lang('Previous')}
            />
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.next)}
              onClick={handleOpenNextStory}
              aria-label={lang('Next')}
            />
          </>
        )}
        <MediaAreaOverlay mediaAreas={mediaAreas} mediaDimensions={dimensions} />
      </div>

      {isSelf && renderRecentViewers()}
      {canShareOwn && (
        <Button
          className={styles.ownForward}
          color="translucent"
          size="smaller"
          round
          onClick={handleForwardClick}
          ariaLabel={lang('Forward')}
        >
          <i className="icon icon-forward" aria-hidden />
        </Button>
      )}
      {shouldRenderCaptionBackdrop && (
        <div
          tabIndex={0}
          role="button"
          className={buildClassName(styles.captionBackdrop, captionBackdropTransitionClassNames)}
          onClick={() => foldCaption()}
          aria-label={lang('Close')}
        />
      )}
      {hasText && <div className={styles.captionGradient} />}
      {hasText && (
        <StoryCaption
          key={`caption-${storyId}-${userId}`}
          story={story as ApiStory}
          isExpanded={isCaptionExpanded}
          onExpand={expandCaption}
          onFold={foldCaption}
          className={appearanceAnimationClassNames}
        />
      )}
      {shouldRenderComposer && (
        <Composer
          type="story"
          chatId={userId}
          threadId={MAIN_THREAD_ID}
          storyId={storyId}
          isReady={!isSelf}
          messageListType="thread"
          isMobile={getIsMobile()}
          editableInputCssSelector={EDITABLE_STORY_INPUT_CSS_SELECTOR}
          editableInputId={EDITABLE_STORY_INPUT_ID}
          inputId="story-input-text"
          className={buildClassName(styles.composer, composerAppearanceAnimationClassNames)}
          inputPlaceholder={lang('ReplyPrivately')}
          onForward={canShare ? handleForwardClick : undefined}
          onFocus={markComposerHasFocus}
          onBlur={unmarkComposerHasFocus}
        />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, {
  userId, storyId, isPrivateStories, isArchivedStories, isReportModalOpen, isDeleteModalOpen,
}): StateProps => {
  const { currentUserId, appConfig } = global;
  const user = global.users.byId[userId];
  const chat = selectChat(global, userId);
  const tabState = selectTabState(global);
  const {
    storyViewer: {
      isMuted,
      viewModal,
      isPrivacyModalOpen,
      isStealthModalOpen,
    },
    forwardMessages: { storyId: forwardedStoryId },
    premiumModal,
    safeLinkModalUrl,
    mapModal,
  } = tabState;
  const { isOpen: isPremiumModalOpen } = premiumModal || {};
  const { orderedIds, pinnedIds, archiveIds } = selectUserStories(global, userId) || {};
  const story = selectUserStory(global, userId, storyId);
  const shouldForcePause = Boolean(
    viewModal || forwardedStoryId || tabState.reactionPicker?.storyId || isReportModalOpen || isPrivacyModalOpen
    || isPremiumModalOpen || isDeleteModalOpen || safeLinkModalUrl || isStealthModalOpen || mapModal,
  );

  return {
    user,
    story,
    orderedIds: isArchivedStories ? archiveIds : (isPrivateStories ? pinnedIds : orderedIds),
    isMuted,
    isSelf: currentUserId === userId,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    shouldForcePause,
    storyChangelogUserId: appConfig!.storyChangelogUserId,
    viewersExpirePeriod: appConfig!.storyExpirePeriod + appConfig!.storyViewersExpirePeriod,
    isChatExist: Boolean(chat),
    areChatSettingsLoaded: Boolean(chat?.settings),
    stealthMode: global.stories.stealthMode,
  };
})(Story));
