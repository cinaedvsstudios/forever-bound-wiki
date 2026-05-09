const DESIGN_STORAGE_KEY = "forever-bound-design-settings";

const DESIGN_FIELDS = [
  {
    "key": "systemFont",
    "selector": "#systemFont",
    "defaultValue": "Georgia, 'Times New Roman', serif",
    "type": "text",
    "cssVar": "--fb-system-font",
    "unit": ""
  },
  {
    "key": "defaultTextSize",
    "selector": "#defaultTextSize",
    "defaultValue": 16,
    "type": "number",
    "cssVar": "--fb-default-text-size",
    "unit": "px"
  },
  {
    "key": "defaultTextColor",
    "selector": "#defaultTextColor",
    "defaultValue": "#f4ead3",
    "type": "color",
    "cssVar": "--fb-default-text-color",
    "unit": ""
  },
  {
    "key": "defaultLabelColor",
    "selector": "#defaultLabelColor",
    "defaultValue": "#d6b981",
    "type": "color",
    "cssVar": "--fb-default-label-color",
    "unit": ""
  },
  {
    "key": "defaultDynamicTextColor",
    "selector": "#defaultDynamicTextColor",
    "defaultValue": "#f7d27c",
    "type": "color",
    "cssVar": "--fb-default-dynamic-text-color",
    "unit": ""
  },
  {
    "key": "defaultButtonBackground",
    "selector": "#defaultButtonBackground",
    "defaultValue": "#3b2a18",
    "type": "color",
    "cssVar": "--fb-default-button-background",
    "unit": ""
  },
  {
    "key": "defaultButtonBorder",
    "selector": "#defaultButtonBorder",
    "defaultValue": "1px solid #b58a4a",
    "type": "text",
    "cssVar": "--fb-default-button-border",
    "unit": ""
  },
  {
    "key": "defaultButtonText",
    "selector": "#defaultButtonText",
    "defaultValue": "#fff5d6",
    "type": "color",
    "cssVar": "--fb-default-button-text",
    "unit": ""
  },
  {
    "key": "defaultButtonTextSize",
    "selector": "#defaultButtonTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-default-button-text-size",
    "unit": "px"
  },
  {
    "key": "defaultButtonBold",
    "selector": "#defaultButtonBold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-default-button-bold",
    "unit": ""
  },
  {
    "key": "defaultWindowBackground",
    "selector": "#defaultWindowBackground",
    "defaultValue": "#1b1610",
    "type": "color",
    "cssVar": "--fb-default-window-background",
    "unit": ""
  },
  {
    "key": "defaultWindowBorder",
    "selector": "#defaultWindowBorder",
    "defaultValue": "1px solid #8b6a3f",
    "type": "text",
    "cssVar": "--fb-default-window-border",
    "unit": ""
  },
  {
    "key": "defaultWindowShadow",
    "selector": "#defaultWindowShadow",
    "defaultValue": "0 18px 40px rgba(0,0,0,.45)",
    "type": "text",
    "cssVar": "--fb-default-window-shadow",
    "unit": ""
  },
  {
    "key": "scrollbarTrack",
    "selector": "#scrollbarTrack",
    "defaultValue": "#21170f",
    "type": "color",
    "cssVar": "--fb-scrollbar-track",
    "unit": ""
  },
  {
    "key": "scrollbarThumb",
    "selector": "#scrollbarThumb",
    "defaultValue": "#a67c45",
    "type": "color",
    "cssVar": "--fb-scrollbar-thumb",
    "unit": ""
  },
  {
    "key": "globalBackgroundImage",
    "selector": "#globalBackgroundImage",
    "defaultValue": "url('wallpaper.jpg')",
    "type": "text",
    "cssVar": "--fb-global-background-image",
    "unit": ""
  },
  {
    "key": "titleBarBackgroundImage",
    "selector": "#titleBarBackgroundImage",
    "defaultValue": "",
    "type": "text",
    "cssVar": "--fb-title-bar-background-image",
    "unit": ""
  },
  {
    "key": "dialogueBackground",
    "selector": "#dialogueBackground",
    "defaultValue": "#21180f",
    "type": "color",
    "cssVar": "--fb-dialogue-background",
    "unit": ""
  },
  {
    "key": "dialogueBorder",
    "selector": "#dialogueBorder",
    "defaultValue": "1px solid #c79b5c",
    "type": "text",
    "cssVar": "--fb-dialogue-border",
    "unit": ""
  },
  {
    "key": "dialogueShadow",
    "selector": "#dialogueShadow",
    "defaultValue": "0 18px 42px rgba(0,0,0,.5)",
    "type": "text",
    "cssVar": "--fb-dialogue-shadow",
    "unit": ""
  },
  {
    "key": "dialogueText",
    "selector": "#dialogueText",
    "defaultValue": "#f7edd5",
    "type": "color",
    "cssVar": "--fb-dialogue-text",
    "unit": ""
  },
  {
    "key": "dialogueTextSize",
    "selector": "#dialogueTextSize",
    "defaultValue": 15,
    "type": "number",
    "cssVar": "--fb-dialogue-text-size",
    "unit": "px"
  },
  {
    "key": "dialogueBold",
    "selector": "#dialogueBold",
    "defaultValue": false,
    "type": "checkbox",
    "cssVar": "--fb-dialogue-bold",
    "unit": ""
  },
  {
    "key": "dialogueButtonBackground",
    "selector": "#dialogueButtonBackground",
    "defaultValue": "#5b3f22",
    "type": "color",
    "cssVar": "--fb-dialogue-button-background",
    "unit": ""
  },
  {
    "key": "dialogueButtonBorder",
    "selector": "#dialogueButtonBorder",
    "defaultValue": "1px solid #d4ad6a",
    "type": "text",
    "cssVar": "--fb-dialogue-button-border",
    "unit": ""
  },
  {
    "key": "dialogueButtonText",
    "selector": "#dialogueButtonText",
    "defaultValue": "#fff7da",
    "type": "color",
    "cssVar": "--fb-dialogue-button-text",
    "unit": ""
  },
  {
    "key": "dialogueButtonSize",
    "selector": "#dialogueButtonSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-dialogue-button-size",
    "unit": "px"
  },
  {
    "key": "dialogueButtonShadow",
    "selector": "#dialogueButtonShadow",
    "defaultValue": "0 3px 10px rgba(0,0,0,.35)",
    "type": "text",
    "cssVar": "--fb-dialogue-button-shadow",
    "unit": ""
  },
  {
    "key": "capsanotoLogoSize",
    "selector": "#capsanotoLogoSize",
    "defaultValue": 42,
    "type": "number",
    "cssVar": "--fb-capsanoto-logo-size",
    "unit": "px"
  },
  {
    "key": "topMenuTitleColor",
    "selector": "#topMenuTitleColor",
    "defaultValue": "#f6d98f",
    "type": "color",
    "cssVar": "--fb-top-menu-title-color",
    "unit": ""
  },
  {
    "key": "topMenuTitleSize",
    "selector": "#topMenuTitleSize",
    "defaultValue": 22,
    "type": "number",
    "cssVar": "--fb-top-menu-title-size",
    "unit": "px"
  },
  {
    "key": "topBarBackground",
    "selector": "#topBarBackground",
    "defaultValue": "#18120b",
    "type": "color",
    "cssVar": "--fb-top-bar-background",
    "unit": ""
  },
  {
    "key": "topBarBorder",
    "selector": "#topBarBorder",
    "defaultValue": "1px solid #8d6638",
    "type": "text",
    "cssVar": "--fb-top-bar-border",
    "unit": ""
  },
  {
    "key": "topBarImage",
    "selector": "#topBarImage",
    "defaultValue": "url('bar.jpg')",
    "type": "text",
    "cssVar": "--fb-top-bar-image",
    "unit": ""
  },
  {
    "key": "writingRoomButtonBackground",
    "selector": "#writingRoomButtonBackground",
    "defaultValue": "#3a2615",
    "type": "color",
    "cssVar": "--fb-writing-room-button-background",
    "unit": ""
  },
  {
    "key": "writingRoomButtonBorder",
    "selector": "#writingRoomButtonBorder",
    "defaultValue": "1px solid #b68a4c",
    "type": "text",
    "cssVar": "--fb-writing-room-button-border",
    "unit": ""
  },
  {
    "key": "writingRoomButtonText",
    "selector": "#writingRoomButtonText",
    "defaultValue": "#fff1c2",
    "type": "color",
    "cssVar": "--fb-writing-room-button-text",
    "unit": ""
  },
  {
    "key": "writingRoomButtonTextSize",
    "selector": "#writingRoomButtonTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-writing-room-button-text-size",
    "unit": "px"
  },
  {
    "key": "statusBoxBackground",
    "selector": "#statusBoxBackground",
    "defaultValue": "#24180e",
    "type": "color",
    "cssVar": "--fb-status-box-background",
    "unit": ""
  },
  {
    "key": "statusBoxBorder",
    "selector": "#statusBoxBorder",
    "defaultValue": "1px solid #76502d",
    "type": "text",
    "cssVar": "--fb-status-box-border",
    "unit": ""
  },
  {
    "key": "statusBoxText",
    "selector": "#statusBoxText",
    "defaultValue": "#f5deaa",
    "type": "color",
    "cssVar": "--fb-status-box-text",
    "unit": ""
  },
  {
    "key": "statusBoxTextSize",
    "selector": "#statusBoxTextSize",
    "defaultValue": 13,
    "type": "number",
    "cssVar": "--fb-status-box-text-size",
    "unit": "px"
  },
  {
    "key": "commandBarBackground",
    "selector": "#commandBarBackground",
    "defaultValue": "#100d09",
    "type": "color",
    "cssVar": "--fb-command-bar-background",
    "unit": ""
  },
  {
    "key": "commandBarBorder",
    "selector": "#commandBarBorder",
    "defaultValue": "1px solid #694b2e",
    "type": "text",
    "cssVar": "--fb-command-bar-border",
    "unit": ""
  },
  {
    "key": "commandBarText",
    "selector": "#commandBarText",
    "defaultValue": "#f3e8ca",
    "type": "color",
    "cssVar": "--fb-command-bar-text",
    "unit": ""
  },
  {
    "key": "commandBarTextSize",
    "selector": "#commandBarTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-command-bar-text-size",
    "unit": "px"
  },
  {
    "key": "dropdownButtonBackground",
    "selector": "#dropdownButtonBackground",
    "defaultValue": "#302112",
    "type": "color",
    "cssVar": "--fb-dropdown-button-background",
    "unit": ""
  },
  {
    "key": "dropdownButtonBorder",
    "selector": "#dropdownButtonBorder",
    "defaultValue": "1px solid #987042",
    "type": "text",
    "cssVar": "--fb-dropdown-button-border",
    "unit": ""
  },
  {
    "key": "dropdownButtonText",
    "selector": "#dropdownButtonText",
    "defaultValue": "#fff4ce",
    "type": "color",
    "cssVar": "--fb-dropdown-button-text",
    "unit": ""
  },
  {
    "key": "dropdownButtonTextSize",
    "selector": "#dropdownButtonTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-dropdown-button-text-size",
    "unit": "px"
  },
  {
    "key": "dropdownButtonBold",
    "selector": "#dropdownButtonBold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-dropdown-button-bold",
    "unit": ""
  },
  {
    "key": "rightIconButtonBackground",
    "selector": "#rightIconButtonBackground",
    "defaultValue": "#261a10",
    "type": "color",
    "cssVar": "--fb-right-icon-button-background",
    "unit": ""
  },
  {
    "key": "rightIconButtonBorder",
    "selector": "#rightIconButtonBorder",
    "defaultValue": "1px solid #8f693e",
    "type": "text",
    "cssVar": "--fb-right-icon-button-border",
    "unit": ""
  },
  {
    "key": "rightIconSize",
    "selector": "#rightIconSize",
    "defaultValue": 18,
    "type": "number",
    "cssVar": "--fb-right-icon-size",
    "unit": "px"
  },
  {
    "key": "writingRoomWindowBackground",
    "selector": "#writingRoomWindowBackground",
    "defaultValue": "#1d1711",
    "type": "color",
    "cssVar": "--fb-writing-room-window-background",
    "unit": ""
  },
  {
    "key": "writingRoomWindowBorder",
    "selector": "#writingRoomWindowBorder",
    "defaultValue": "1px solid #8e6b42",
    "type": "text",
    "cssVar": "--fb-writing-room-window-border",
    "unit": ""
  },
  {
    "key": "writingRoomWindowShadow",
    "selector": "#writingRoomWindowShadow",
    "defaultValue": "0 16px 36px rgba(0,0,0,.45)",
    "type": "text",
    "cssVar": "--fb-writing-room-window-shadow",
    "unit": ""
  },
  {
    "key": "writingRoomTitleColor",
    "selector": "#writingRoomTitleColor",
    "defaultValue": "#f3d68d",
    "type": "color",
    "cssVar": "--fb-writing-room-title-color",
    "unit": ""
  },
  {
    "key": "writingRoomTitleSize",
    "selector": "#writingRoomTitleSize",
    "defaultValue": 20,
    "type": "number",
    "cssVar": "--fb-writing-room-title-size",
    "unit": "px"
  },
  {
    "key": "headerIconSize",
    "selector": "#headerIconSize",
    "defaultValue": 22,
    "type": "number",
    "cssVar": "--fb-header-icon-size",
    "unit": "px"
  },
  {
    "key": "folderIconSize",
    "selector": "#folderIconSize",
    "defaultValue": 18,
    "type": "number",
    "cssVar": "--fb-folder-icon-size",
    "unit": "px"
  },
  {
    "key": "tabIconSize",
    "selector": "#tabIconSize",
    "defaultValue": 16,
    "type": "number",
    "cssVar": "--fb-tab-icon-size",
    "unit": "px"
  },
  {
    "key": "documentIconSize",
    "selector": "#documentIconSize",
    "defaultValue": 16,
    "type": "number",
    "cssVar": "--fb-document-icon-size",
    "unit": "px"
  },
  {
    "key": "railIconSize",
    "selector": "#railIconSize",
    "defaultValue": 15,
    "type": "number",
    "cssVar": "--fb-rail-icon-size",
    "unit": "px"
  },
  {
    "key": "folderRowBackground",
    "selector": "#folderRowBackground",
    "defaultValue": "#2d2116",
    "type": "color",
    "cssVar": "--fb-folder-row-background",
    "unit": ""
  },
  {
    "key": "folderRowBorder",
    "selector": "#folderRowBorder",
    "defaultValue": "1px solid #765637",
    "type": "text",
    "cssVar": "--fb-folder-row-border",
    "unit": ""
  },
  {
    "key": "folderRowText",
    "selector": "#folderRowText",
    "defaultValue": "#f6e0b4",
    "type": "color",
    "cssVar": "--fb-folder-row-text",
    "unit": ""
  },
  {
    "key": "folderRowTextSize",
    "selector": "#folderRowTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-folder-row-text-size",
    "unit": "px"
  },
  {
    "key": "tabRowBackground",
    "selector": "#tabRowBackground",
    "defaultValue": "#241a12",
    "type": "color",
    "cssVar": "--fb-tab-row-background",
    "unit": ""
  },
  {
    "key": "tabRowBorder",
    "selector": "#tabRowBorder",
    "defaultValue": "1px solid #60452c",
    "type": "text",
    "cssVar": "--fb-tab-row-border",
    "unit": ""
  },
  {
    "key": "tabRowText",
    "selector": "#tabRowText",
    "defaultValue": "#ead0a3",
    "type": "color",
    "cssVar": "--fb-tab-row-text",
    "unit": ""
  },
  {
    "key": "tabRowTextSize",
    "selector": "#tabRowTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-tab-row-text-size",
    "unit": "px"
  },
  {
    "key": "documentRowBackground",
    "selector": "#documentRowBackground",
    "defaultValue": "#1a140e",
    "type": "color",
    "cssVar": "--fb-document-row-background",
    "unit": ""
  },
  {
    "key": "documentRowBorder",
    "selector": "#documentRowBorder",
    "defaultValue": "1px solid #4f3925",
    "type": "text",
    "cssVar": "--fb-document-row-border",
    "unit": ""
  },
  {
    "key": "documentRowText",
    "selector": "#documentRowText",
    "defaultValue": "#f0e3ca",
    "type": "color",
    "cssVar": "--fb-document-row-text",
    "unit": ""
  },
  {
    "key": "documentRowTextSize",
    "selector": "#documentRowTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-document-row-text-size",
    "unit": "px"
  },
  {
    "key": "expandedDocumentTextColor",
    "selector": "#expandedDocumentTextColor",
    "defaultValue": "#d6c39e",
    "type": "color",
    "cssVar": "--fb-expanded-document-text-color",
    "unit": ""
  },
  {
    "key": "expandedDocumentTextSize",
    "selector": "#expandedDocumentTextSize",
    "defaultValue": 13,
    "type": "number",
    "cssVar": "--fb-expanded-document-text-size",
    "unit": "px"
  },
  {
    "key": "metadataPillBackground",
    "selector": "#metadataPillBackground",
    "defaultValue": "#362718",
    "type": "color",
    "cssVar": "--fb-metadata-pill-background",
    "unit": ""
  },
  {
    "key": "metadataPillBorder",
    "selector": "#metadataPillBorder",
    "defaultValue": "1px solid #86623b",
    "type": "text",
    "cssVar": "--fb-metadata-pill-border",
    "unit": ""
  },
  {
    "key": "metadataPillText",
    "selector": "#metadataPillText",
    "defaultValue": "#f6dca7",
    "type": "color",
    "cssVar": "--fb-metadata-pill-text",
    "unit": ""
  },
  {
    "key": "metadataPillTextSize",
    "selector": "#metadataPillTextSize",
    "defaultValue": 12,
    "type": "number",
    "cssVar": "--fb-metadata-pill-text-size",
    "unit": "px"
  },
  {
    "key": "trashSectionBackground",
    "selector": "#trashSectionBackground",
    "defaultValue": "#251412",
    "type": "color",
    "cssVar": "--fb-trash-section-background",
    "unit": ""
  },
  {
    "key": "trashSectionBorder",
    "selector": "#trashSectionBorder",
    "defaultValue": "1px solid #7b423a",
    "type": "text",
    "cssVar": "--fb-trash-section-border",
    "unit": ""
  },
  {
    "key": "jumpRailLineColor",
    "selector": "#jumpRailLineColor",
    "defaultValue": "#785939",
    "type": "color",
    "cssVar": "--fb-jump-rail-line-color",
    "unit": ""
  },
  {
    "key": "jumpRailButtonColor",
    "selector": "#jumpRailButtonColor",
    "defaultValue": "#d4ad6a",
    "type": "color",
    "cssVar": "--fb-jump-rail-button-color",
    "unit": ""
  },
  {
    "key": "jumpRailIconColor",
    "selector": "#jumpRailIconColor",
    "defaultValue": "#fff1c5",
    "type": "color",
    "cssVar": "--fb-jump-rail-icon-color",
    "unit": ""
  },
  {
    "key": "editorBackground",
    "selector": "#editorBackground",
    "defaultValue": "#211910",
    "type": "color",
    "cssVar": "--fb-editor-background",
    "unit": ""
  },
  {
    "key": "editorOverlay",
    "selector": "#editorOverlay",
    "defaultValue": "linear-gradient(rgba(255,255,255,.03), rgba(0,0,0,.08))",
    "type": "text",
    "cssVar": "--fb-editor-overlay",
    "unit": ""
  },
  {
    "key": "editorBorder",
    "selector": "#editorBorder",
    "defaultValue": "1px solid #8c693d",
    "type": "text",
    "cssVar": "--fb-editor-border",
    "unit": ""
  },
  {
    "key": "editorText",
    "selector": "#editorText",
    "defaultValue": "#f7ecd3",
    "type": "color",
    "cssVar": "--fb-editor-text",
    "unit": ""
  },
  {
    "key": "normalTextSize",
    "selector": "#normalTextSize",
    "defaultValue": 16,
    "type": "number",
    "cssVar": "--fb-normal-text-size",
    "unit": "px"
  },
  {
    "key": "normalTextBold",
    "selector": "#normalTextBold",
    "defaultValue": false,
    "type": "checkbox",
    "cssVar": "--fb-normal-text-bold",
    "unit": ""
  },
  {
    "key": "documentTitleColor",
    "selector": "#documentTitleColor",
    "defaultValue": "#ffd98a",
    "type": "color",
    "cssVar": "--fb-document-title-color",
    "unit": ""
  },
  {
    "key": "documentTitleSize",
    "selector": "#documentTitleSize",
    "defaultValue": 30,
    "type": "number",
    "cssVar": "--fb-document-title-size",
    "unit": "px"
  },
  {
    "key": "h1Color",
    "selector": "#h1Color",
    "defaultValue": "#ffd27a",
    "type": "color",
    "cssVar": "--fb-h1-color",
    "unit": ""
  },
  {
    "key": "h1Size",
    "selector": "#h1Size",
    "defaultValue": 26,
    "type": "number",
    "cssVar": "--fb-h1-size",
    "unit": "px"
  },
  {
    "key": "h1Bold",
    "selector": "#h1Bold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-h1-bold",
    "unit": ""
  },
  {
    "key": "h2Color",
    "selector": "#h2Color",
    "defaultValue": "#efc06f",
    "type": "color",
    "cssVar": "--fb-h2-color",
    "unit": ""
  },
  {
    "key": "h2Size",
    "selector": "#h2Size",
    "defaultValue": 22,
    "type": "number",
    "cssVar": "--fb-h2-size",
    "unit": "px"
  },
  {
    "key": "h2Bold",
    "selector": "#h2Bold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-h2-bold",
    "unit": ""
  },
  {
    "key": "h3Color",
    "selector": "#h3Color",
    "defaultValue": "#e5b963",
    "type": "color",
    "cssVar": "--fb-h3-color",
    "unit": ""
  },
  {
    "key": "h3Size",
    "selector": "#h3Size",
    "defaultValue": 19,
    "type": "number",
    "cssVar": "--fb-h3-size",
    "unit": "px"
  },
  {
    "key": "h3Bold",
    "selector": "#h3Bold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-h3-bold",
    "unit": ""
  },
  {
    "key": "normalLinkColor",
    "selector": "#normalLinkColor",
    "defaultValue": "#8fd3ff",
    "type": "color",
    "cssVar": "--fb-normal-link-color",
    "unit": ""
  },
  {
    "key": "normalLinkSize",
    "selector": "#normalLinkSize",
    "defaultValue": 16,
    "type": "number",
    "cssVar": "--fb-normal-link-size",
    "unit": "px"
  },
  {
    "key": "normalLinkBold",
    "selector": "#normalLinkBold",
    "defaultValue": false,
    "type": "checkbox",
    "cssVar": "--fb-normal-link-bold",
    "unit": ""
  },
  {
    "key": "normalLinkUnderline",
    "selector": "#normalLinkUnderline",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-normal-link-underline",
    "unit": ""
  },
  {
    "key": "linkPillBackground",
    "selector": "#linkPillBackground",
    "defaultValue": "#233247",
    "type": "color",
    "cssVar": "--fb-link-pill-background",
    "unit": ""
  },
  {
    "key": "linkPillBorder",
    "selector": "#linkPillBorder",
    "defaultValue": "1px solid #6094c1",
    "type": "text",
    "cssVar": "--fb-link-pill-border",
    "unit": ""
  },
  {
    "key": "linkPillText",
    "selector": "#linkPillText",
    "defaultValue": "#dff3ff",
    "type": "color",
    "cssVar": "--fb-link-pill-text",
    "unit": ""
  },
  {
    "key": "linkPillSize",
    "selector": "#linkPillSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-link-pill-size",
    "unit": "px"
  },
  {
    "key": "linkPillBold",
    "selector": "#linkPillBold",
    "defaultValue": true,
    "type": "checkbox",
    "cssVar": "--fb-link-pill-bold",
    "unit": ""
  },
  {
    "key": "linkPillUnderline",
    "selector": "#linkPillUnderline",
    "defaultValue": false,
    "type": "checkbox",
    "cssVar": "--fb-link-pill-underline",
    "unit": ""
  },
  {
    "key": "emphasisBoxBackground",
    "selector": "#emphasisBoxBackground",
    "defaultValue": "#322211",
    "type": "color",
    "cssVar": "--fb-emphasis-box-background",
    "unit": ""
  },
  {
    "key": "emphasisBoxBorder",
    "selector": "#emphasisBoxBorder",
    "defaultValue": "1px solid #b47d3c",
    "type": "text",
    "cssVar": "--fb-emphasis-box-border",
    "unit": ""
  },
  {
    "key": "emphasisBoxText",
    "selector": "#emphasisBoxText",
    "defaultValue": "#fff0c8",
    "type": "color",
    "cssVar": "--fb-emphasis-box-text",
    "unit": ""
  },
  {
    "key": "emphasisBoxSize",
    "selector": "#emphasisBoxSize",
    "defaultValue": 15,
    "type": "number",
    "cssVar": "--fb-emphasis-box-size",
    "unit": "px"
  },
  {
    "key": "emphasisBoxBold",
    "selector": "#emphasisBoxBold",
    "defaultValue": false,
    "type": "checkbox",
    "cssVar": "--fb-emphasis-box-bold",
    "unit": ""
  },
  {
    "key": "tableBackground",
    "selector": "#tableBackground",
    "defaultValue": "#19130d",
    "type": "color",
    "cssVar": "--fb-table-background",
    "unit": ""
  },
  {
    "key": "tableBorder",
    "selector": "#tableBorder",
    "defaultValue": "1px solid #6f5434",
    "type": "text",
    "cssVar": "--fb-table-border",
    "unit": ""
  },
  {
    "key": "tableHeaderText",
    "selector": "#tableHeaderText",
    "defaultValue": "#ffe0a3",
    "type": "color",
    "cssVar": "--fb-table-header-text",
    "unit": ""
  },
  {
    "key": "tableBodyText",
    "selector": "#tableBodyText",
    "defaultValue": "#f0e4ce",
    "type": "color",
    "cssVar": "--fb-table-body-text",
    "unit": ""
  },
  {
    "key": "bottomDetailsBackground",
    "selector": "#bottomDetailsBackground",
    "defaultValue": "#18110b",
    "type": "color",
    "cssVar": "--fb-bottom-details-background",
    "unit": ""
  },
  {
    "key": "bottomDetailsBorder",
    "selector": "#bottomDetailsBorder",
    "defaultValue": "1px solid #6c4e2f",
    "type": "text",
    "cssVar": "--fb-bottom-details-border",
    "unit": ""
  },
  {
    "key": "bottomDetailsText",
    "selector": "#bottomDetailsText",
    "defaultValue": "#d9c7a7",
    "type": "color",
    "cssVar": "--fb-bottom-details-text",
    "unit": ""
  },
  {
    "key": "bottomDetailsTextSize",
    "selector": "#bottomDetailsTextSize",
    "defaultValue": 13,
    "type": "number",
    "cssVar": "--fb-bottom-details-text-size",
    "unit": "px"
  },
  {
    "key": "guideWindowBackground",
    "selector": "#guideWindowBackground",
    "defaultValue": "#1c1711",
    "type": "color",
    "cssVar": "--fb-guide-window-background",
    "unit": ""
  },
  {
    "key": "guideWindowBorder",
    "selector": "#guideWindowBorder",
    "defaultValue": "1px solid #927046",
    "type": "text",
    "cssVar": "--fb-guide-window-border",
    "unit": ""
  },
  {
    "key": "guideWindowShadow",
    "selector": "#guideWindowShadow",
    "defaultValue": "0 18px 42px rgba(0,0,0,.45)",
    "type": "text",
    "cssVar": "--fb-guide-window-shadow",
    "unit": ""
  },
  {
    "key": "guideLogoSize",
    "selector": "#guideLogoSize",
    "defaultValue": 54,
    "type": "number",
    "cssVar": "--fb-guide-logo-size",
    "unit": "px"
  },
  {
    "key": "guideTitleColor",
    "selector": "#guideTitleColor",
    "defaultValue": "#f8d98a",
    "type": "color",
    "cssVar": "--fb-guide-title-color",
    "unit": ""
  },
  {
    "key": "guideTitleSize",
    "selector": "#guideTitleSize",
    "defaultValue": 26,
    "type": "number",
    "cssVar": "--fb-guide-title-size",
    "unit": "px"
  },
  {
    "key": "guideTextColor",
    "selector": "#guideTextColor",
    "defaultValue": "#efe2c9",
    "type": "color",
    "cssVar": "--fb-guide-text-color",
    "unit": ""
  },
  {
    "key": "guideTextSize",
    "selector": "#guideTextSize",
    "defaultValue": 15,
    "type": "number",
    "cssVar": "--fb-guide-text-size",
    "unit": "px"
  },
  {
    "key": "guideHeadingColor",
    "selector": "#guideHeadingColor",
    "defaultValue": "#ffd685",
    "type": "color",
    "cssVar": "--fb-guide-heading-color",
    "unit": ""
  },
  {
    "key": "guideHeadingSize",
    "selector": "#guideHeadingSize",
    "defaultValue": 20,
    "type": "number",
    "cssVar": "--fb-guide-heading-size",
    "unit": "px"
  },
  {
    "key": "guideRuleColor",
    "selector": "#guideRuleColor",
    "defaultValue": "#7b5b37",
    "type": "color",
    "cssVar": "--fb-guide-rule-color",
    "unit": ""
  },
  {
    "key": "guideScrollbarTrack",
    "selector": "#guideScrollbarTrack",
    "defaultValue": "#21170f",
    "type": "color",
    "cssVar": "--fb-guide-scrollbar-track",
    "unit": ""
  },
  {
    "key": "guideScrollbarThumb",
    "selector": "#guideScrollbarThumb",
    "defaultValue": "#b38245",
    "type": "color",
    "cssVar": "--fb-guide-scrollbar-thumb",
    "unit": ""
  },
  {
    "key": "guideEditButtonBackground",
    "selector": "#guideEditButtonBackground",
    "defaultValue": "#3b2918",
    "type": "color",
    "cssVar": "--fb-guide-edit-button-background",
    "unit": ""
  },
  {
    "key": "guideEditButtonBorder",
    "selector": "#guideEditButtonBorder",
    "defaultValue": "1px solid #ad8049",
    "type": "text",
    "cssVar": "--fb-guide-edit-button-border",
    "unit": ""
  },
  {
    "key": "guideEditButtonText",
    "selector": "#guideEditButtonText",
    "defaultValue": "#fff3cf",
    "type": "color",
    "cssVar": "--fb-guide-edit-button-text",
    "unit": ""
  },
  {
    "key": "guideEditButtonTextSize",
    "selector": "#guideEditButtonTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-guide-edit-button-text-size",
    "unit": "px"
  },
  {
    "key": "settingsWindowBackground",
    "selector": "#settingsWindowBackground",
    "defaultValue": "#1b1611",
    "type": "color",
    "cssVar": "--fb-settings-window-background",
    "unit": ""
  },
  {
    "key": "settingsWindowBorder",
    "selector": "#settingsWindowBorder",
    "defaultValue": "1px solid #80613e",
    "type": "text",
    "cssVar": "--fb-settings-window-border",
    "unit": ""
  },
  {
    "key": "settingsWindowShadow",
    "selector": "#settingsWindowShadow",
    "defaultValue": "0 18px 44px rgba(0,0,0,.48)",
    "type": "text",
    "cssVar": "--fb-settings-window-shadow",
    "unit": ""
  },
  {
    "key": "settingsTitleColor",
    "selector": "#settingsTitleColor",
    "defaultValue": "#f5d58b",
    "type": "color",
    "cssVar": "--fb-settings-title-color",
    "unit": ""
  },
  {
    "key": "settingsTitleSize",
    "selector": "#settingsTitleSize",
    "defaultValue": 24,
    "type": "number",
    "cssVar": "--fb-settings-title-size",
    "unit": "px"
  },
  {
    "key": "settingsCardBackground",
    "selector": "#settingsCardBackground",
    "defaultValue": "#241b12",
    "type": "color",
    "cssVar": "--fb-settings-card-background",
    "unit": ""
  },
  {
    "key": "settingsCardBorder",
    "selector": "#settingsCardBorder",
    "defaultValue": "1px solid #6d5032",
    "type": "text",
    "cssVar": "--fb-settings-card-border",
    "unit": ""
  },
  {
    "key": "settingsCardTitleColor",
    "selector": "#settingsCardTitleColor",
    "defaultValue": "#ffd98f",
    "type": "color",
    "cssVar": "--fb-settings-card-title-color",
    "unit": ""
  },
  {
    "key": "settingsCardTitleSize",
    "selector": "#settingsCardTitleSize",
    "defaultValue": 18,
    "type": "number",
    "cssVar": "--fb-settings-card-title-size",
    "unit": "px"
  },
  {
    "key": "settingsLabelColor",
    "selector": "#settingsLabelColor",
    "defaultValue": "#d9bf91",
    "type": "color",
    "cssVar": "--fb-settings-label-color",
    "unit": ""
  },
  {
    "key": "settingsLabelSize",
    "selector": "#settingsLabelSize",
    "defaultValue": 13,
    "type": "number",
    "cssVar": "--fb-settings-label-size",
    "unit": "px"
  },
  {
    "key": "settingsInputBackground",
    "selector": "#settingsInputBackground",
    "defaultValue": "#120e0a",
    "type": "color",
    "cssVar": "--fb-settings-input-background",
    "unit": ""
  },
  {
    "key": "settingsInputBorder",
    "selector": "#settingsInputBorder",
    "defaultValue": "1px solid #755638",
    "type": "text",
    "cssVar": "--fb-settings-input-border",
    "unit": ""
  },
  {
    "key": "settingsInputText",
    "selector": "#settingsInputText",
    "defaultValue": "#fff3d6",
    "type": "color",
    "cssVar": "--fb-settings-input-text",
    "unit": ""
  },
  {
    "key": "settingsInputTextSize",
    "selector": "#settingsInputTextSize",
    "defaultValue": 14,
    "type": "number",
    "cssVar": "--fb-settings-input-text-size",
    "unit": "px"
  },
  {
    "key": "settingsScrollbarTrack",
    "selector": "#settingsScrollbarTrack",
    "defaultValue": "#20160f",
    "type": "color",
    "cssVar": "--fb-settings-scrollbar-track",
    "unit": ""
  },
  {
    "key": "settingsScrollbarThumb",
    "selector": "#settingsScrollbarThumb",
    "defaultValue": "#9f7444",
    "type": "color",
    "cssVar": "--fb-settings-scrollbar-thumb",
    "unit": ""
  }
];

const els = {
  designForm: document.querySelector(".element-designer-cards"),
  saveDesignSettingsButton: document.querySelector("#saveDesignSettings"),
  resetDesignSettingsButton: document.querySelector("#resetDesignSettings"),
  openTCardPanelButton: document.querySelector("#openTCardPanelButton"),
  tCardPanel: document.querySelector("#tCardPanel"),
  tCardPanelToggle: document.querySelector("#openTCardPanel, [data-open-tcard-panel]"),
};

for (const field of DESIGN_FIELDS) {
  els[field.key] = document.querySelector(field.selector);
}

function defaultDesignSettings() {
  return DESIGN_FIELDS.reduce((settings, field) => {
    settings[field.key] = field.defaultValue;
    return settings;
  }, {});
}

function readDesignForm() {
  const settings = defaultDesignSettings();

  for (const field of DESIGN_FIELDS) {
    const input = els[field.key];
    if (!input) continue;
    if (field.type === "checkbox") settings[field.key] = input.checked;
    else if (field.type === "number") settings[field.key] = Number(input.value || 0);
    else settings[field.key] = input.value;
  }

  return settings;
}

function saveDesignSettings() {
  const settings = readDesignForm();
  localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(settings));
  applyDesignSettings(settings);
  return settings;
}

function loadDesignSettings() {
  try {
    return { ...defaultDesignSettings(), ...JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY) || "{}") };
  } catch (error) {
    console.warn("Unable to load design settings; falling back to defaults.", error);
    return defaultDesignSettings();
  }
}

function loadDesignForm(settings = loadDesignSettings()) {
  for (const field of DESIGN_FIELDS) {
    const input = els[field.key];
    if (!input) continue;
    const value = settings[field.key] ?? field.defaultValue;
    if (field.type === "checkbox") input.checked = Boolean(value);
    else input.value = value;
  }
}

function asCssValue(field, value) {
  if (field.type === "checkbox" && field.key.includes("Underline")) return value ? "underline" : "none";
  if (field.type === "checkbox") return value ? "700" : "400";
  if (field.type === "number") return `${Number(value || 0)}${field.unit}`;
  return value || "none";
}

function applyDesignSettings(settings = loadDesignSettings()) {
  const root = document.documentElement;
  for (const field of DESIGN_FIELDS) {
    root.style.setProperty(field.cssVar, asCssValue(field, settings[field.key] ?? field.defaultValue));
  }
}

function openTCardPanel() {
  if (els.tCardPanelToggle) {
    els.tCardPanelToggle.click();
    return;
  }
  if (els.tCardPanel) {
    els.tCardPanel.removeAttribute("hidden");
    els.tCardPanel.classList.add("is-open");
  }
}

els.designForm?.addEventListener("input", () => applyDesignSettings(readDesignForm()));
els.saveDesignSettingsButton?.addEventListener("click", saveDesignSettings);
els.resetDesignSettingsButton?.addEventListener("click", () => {
  const settings = defaultDesignSettings();
  localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(settings));
  loadDesignForm(settings);
  applyDesignSettings(settings);
});
els.openTCardPanelButton?.addEventListener("click", openTCardPanel);

loadDesignForm();
applyDesignSettings();

window.ForeverBoundDesign = {
  els,
  DESIGN_FIELDS,
  defaultDesignSettings,
  saveDesignSettings,
  loadDesignForm,
  applyDesignSettings,
};
