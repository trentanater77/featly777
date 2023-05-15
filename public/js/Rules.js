'use-strict';

let isPresenter = false;

// ####################################################
// SHOW HIDE DESIRED BUTTONS BY RULES
// ####################################################

const isRulesActive = true;

const BLOCKS = {
    header: {
        headerNav: true,
        headerCenterBlock: true,
    },
    control: {
        control: true,
    },
    loader: {
        globalLoader: true,
    },
    popups: {
        invitePopup: true,
        membersScreens: true,
    },
};

const BUTTONS = {
    main: {
        shareButton: false,
        startAudioButton: true,
        startVideoButton: true,
        startScreenButton: true,
        reactionButton: true,
        swapCameraButton: true,
        chatButton: true,
        participantsButton: true,
        whiteboardButton: true,
        settingsButton: true,
        aboutButton: true, // Please keep me always visible, thank you!
        exitButton: true,
    },
    settings: {
        lockRoomButton: true,
        unlockRoomButton: true,
        lobbyButton: true,
        tabRecording: true,
    },
    producerVideo: {
        fullScreenButton: true,
        snapShotButton: true,
        muteAudioButton: true,
        videoPrivacyButton: true,
    },
    consumerVideo: {
        fullScreenButton: true,
        snapShotButton: true,
        sendMessageButton: true,
        sendFileButton: true,
        sendVideoButton: true,
        muteVideoButton: true,
        muteAudioButton: true,
        audioVolumeInput: true,
        ejectButton: true,
    },
    videoOff: {
        sendMessageButton: true,
        sendFileButton: true,
        sendVideoButton: true,
        muteAudioButton: true,
        audioVolumeInput: true,
        ejectButton: true,
    },
    chat: {
        chatSaveButton: true,
        chatEmojiButton: false,
        chatMarkdownButton: false,
        chatShareFileButton: true,
        chatSpeechStartButton: false,
        resetSearchParticipants: true,
    },
    //...
};

function handleRules(isPresenter) {
    console.log('06.1 ----> IsPresenter: ' + isPresenter);
    if (!isRulesActive) return;
    if (!isPresenter) {
        BUTTONS.settings.lockRoomButton = false;
        BUTTONS.settings.unlockRoomButton = false;
        BUTTONS.settings.lobbyButton = false;
        BUTTONS.videoOff.muteAudioButton = false;
        BUTTONS.videoOff.ejectButton = false;
        BUTTONS.consumerVideo.ejectButton = false;
        BUTTONS.consumerVideo.muteAudioButton = false;
        BUTTONS.consumerVideo.muteVideoButton = false;
        //...
    } else {
        BUTTONS.settings.lockRoomButton = !isRoomLocked;
        BUTTONS.settings.unlockRoomButton = isRoomLocked;
        BUTTONS.settings.lobbyButton = true;
        BUTTONS.videoOff.muteAudioButton = true;
        BUTTONS.videoOff.ejectButton = true;
        BUTTONS.consumerVideo.ejectButton = true;
        BUTTONS.consumerVideo.muteAudioButton = true;
        BUTTONS.consumerVideo.muteVideoButton = true;
        //...
    }
    // main. settings.
    BUTTONS.settings.lockRoomButton ? show(lockRoomButton) : hide(lockRoomButton);
    BUTTONS.settings.unlockRoomButton ? show(unlockRoomButton) : hide(unlockRoomButton);
    BUTTONS.settings.lobbyButton ? show(lobbyButton) : hide(lobbyButton);
    //...
}
