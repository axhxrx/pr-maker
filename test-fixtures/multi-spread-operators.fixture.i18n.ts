const operatorEvents = {
  deviceAdded: {
    label: {
      en: 'Device Added',
      ja: 'デバイス追加',
    },
    description: {
      en: 'Notifiy you when a device is added to your account',
      ja: 'アカウントに新しくデバイスが追加されたときに通知します',
    },
  },
  deviceRemoved: {
    label: {
      en: 'Device Removed',
      ja: 'デバイス削除',
    },
    description: {
      en: 'Notifiy you when a device is removed from your account',
      ja: 'アカウントからデバイスが削除されたときに通知します',
    },
  },
  deviceShareStatusChanged: {
    label: {
      en: 'Device share status changed',
      ja: 'デバイス共有',
    },
    description: {
      en: 'Notifiy you when a device is shared or unshared from another account.',
      ja:
        'ほかのアカウントにデバイスを共有したり共有が解除されたとき、または、ほかのアカウントからデバイスが共有されたり共有が解除されたときに通知します',
    },
  },
} as const;

const deviceEvents = {
  motionDetected: {
    label: {
      en: 'Motion Detected',
      ja: 'モーション検知',
    },
    description: {
      en: 'Notify you when a device detects motion',
      ja: 'デバイスがモーションを検知したときに通知します',
    },
  },
  soundDetected: {
    label: {
      en: 'Sound Detected',
      ja: 'サウンド検知',
    },
    description: {
      en: 'Notify you when a device detects sound',
      ja: 'デバイスがサウンドを検知したときに通知します',
    },
  },
  devicePropertyChanged: {
    label: {
      en: 'Device Property Changed',
      ja: 'デバイスの設定変更',
    },
    description: {
      en: 'Notifiy you when properties of a device changes',
      ja: 'デバイスの設定が変更されたときに通知します',
    },
  },
  connected: {
    label: {
      en: 'Device Connected',
      ja: 'デバイス接続',
    },
    description: {
      en: 'Notifiy you when a device is connected to the network',
      ja: 'デバイスがネットワークに接続されたときに通知します',
    },
  },

  disconnected: {
    label: {
      en: 'Device Disconnected',
      ja: 'デバイス接続切断',
    },
    description: {
      en: 'Notifiy you when a device gets disconnected from the network',
      ja: 'デバイスがネットワークから切断されたときに通知します',
    },
  },
  eventRecordingStarted: {
    label: {
      en: 'Event Detected',
      ja: 'イベント検出',
    },
    description: {
      en: 'Notifiy you when an event recording started',
      ja: 'デバイスがイベントを開始した際に通知します',
    },
  },

  cloudRecordingInterrupted: {
    label: {
      en: 'Cloud Recording Interrrupted',
      ja: 'クラウド録画停止',
    },
    description: {
      en: 'Notifiy you when cloud recording is interrupted',
      ja: 'クラウド録画が停止した際に通知します',
    },
  },
} as const;

export const soraCamNotificationI18n = {
  eventTypes: {
    ...operatorEvents,
    ...deviceEvents,
  },
  enabled: {
    en: 'Enabled',
    ja: '有効',
  },
  disabled: {
    en: 'Disabled',
    ja: '無効',
  },
  noDestinations: {
    en: '(No destinations)',
    ja: '(宛先なし)',
  },
} as const;
