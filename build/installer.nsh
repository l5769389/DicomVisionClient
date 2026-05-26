ManifestDPIAware true
SetFont "Microsoft YaHei UI" 10

LangString ^Font 1033 "Segoe UI"
LangString ^FontSize 1033 "10"
LangString ^Font 2052 "Microsoft YaHei UI"
LangString ^FontSize 2052 "10"
LangString DicomVisionWelcomeTitle 1033 "Welcome to DicomVision"
LangString DicomVisionWelcomeTitle 2052 "欢迎使用 DicomVision"
LangString DicomVisionWelcomeText 1033 "DicomVision will be installed on this computer.$\r$\n$\r$\nThis setup includes the DICOM review workspace and the local processing service required by the application.$\r$\n$\r$\nBefore continuing, close any running DicomVision windows."
LangString DicomVisionWelcomeText 2052 "安装程序会将 DicomVision 安装到此电脑。$\r$\n$\r$\n本安装包包含 DICOM 阅片工作区，以及软件运行所需的本地处理服务。$\r$\n$\r$\n继续之前，请先关闭正在运行的 DicomVision 窗口。"

!macro customWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW DicomVisionWelcomeShow
  !define MUI_WELCOMEPAGE_TITLE "$(DicomVisionWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(DicomVisionWelcomeText)"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !insertmacro MUI_PAGE_WELCOME

  Function DicomVisionWelcomeShow
    CreateFont $3 "$(^Font)" "15" "700"
    CreateFont $4 "$(^Font)" "10" "400"
    SendMessage $mui.WelcomePage.Title ${WM_SETFONT} $3 0
    SendMessage $mui.WelcomePage.Text ${WM_SETFONT} $4 0
    SetCtlColors $mui.WelcomePage.Title "202428" "FFFFFF"
    SetCtlColors $mui.WelcomePage.Text "30363C" "FFFFFF"
  FunctionEnd
!macroend

!macro removeDicomVisionPreviewHandler ROOT_KEY
  DeleteRegKey ${ROOT_KEY} "Software\Classes\.dcm\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\.dcm\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\.dcm\ShellEx"
  DeleteRegValue ${ROOT_KEY} "Software\Classes\.dcm" "PerceivedType"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\.dicom\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\.dicom\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\.dicom\ShellEx"
  DeleteRegValue ${ROOT_KEY} "Software\Classes\.dicom" "PerceivedType"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dcm\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dcm\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dcm\ShellEx"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dcm"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dicom\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dicom\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dicom\ShellEx"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\SystemFileAssociations\.dicom"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\DicomVision.DICOM\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\DicomVision.DICOM\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\DicomVision.DICOM\ShellEx"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\.\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\.\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\.\ShellEx"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\Unknown\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\Unknown\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegKey /ifempty ${ROOT_KEY} "Software\Classes\Unknown\ShellEx"

  DeleteRegKey ${ROOT_KEY} "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey ${ROOT_KEY} "Software\Classes\DicomVision.DicomShellHandler"
  DeleteRegValue ${ROOT_KEY} "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
!macroend

!macro customInstall
  SetRegView 64

  !insertmacro removeDicomVisionPreviewHandler HKCU
  !insertmacro removeDicomVisionPreviewHandler HKLM

  WriteRegStr HKCU "Software\Classes\.dcm" "" "DicomVision.DICOM"
  WriteRegStr HKCU "Software\Classes\.dcm" "Content Type" "application/dicom"
  WriteRegStr HKCU "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM" ""
  WriteRegStr HKCU "Software\Classes\.dicom" "" "DicomVision.DICOM"
  WriteRegStr HKCU "Software\Classes\.dicom" "Content Type" "application/dicom"
  WriteRegStr HKCU "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM" ""

  WriteRegStr HKLM "Software\Classes\.dcm" "" "DicomVision.DICOM"
  WriteRegStr HKLM "Software\Classes\.dcm" "Content Type" "application/dicom"
  WriteRegStr HKLM "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM" ""
  WriteRegStr HKLM "Software\Classes\.dicom" "" "DicomVision.DICOM"
  WriteRegStr HKLM "Software\Classes\.dicom" "Content Type" "application/dicom"
  WriteRegStr HKLM "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM" ""

  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM" "" "DICOM medical image"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM" "FriendlyTypeName" "DICOM medical image"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\DefaultIcon" "" '"$INSTDIR\DicomVision.exe",0'
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell\open" "" "Open with DicomVision"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell\open\command" "" '"$INSTDIR\DicomVision.exe" "%1"'

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  SetRegView 64

  !insertmacro removeDicomVisionPreviewHandler HKCU
  !insertmacro removeDicomVisionPreviewHandler HKLM

  DeleteRegValue HKCU "Software\Classes\.dcm" ""
  DeleteRegValue HKCU "Software\Classes\.dcm" "Content Type"
  DeleteRegValue HKCU "Software\Classes\.dcm" "PerceivedType"
  DeleteRegValue HKCU "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dcm\OpenWithProgids"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dcm"

  DeleteRegValue HKCU "Software\Classes\.dicom" ""
  DeleteRegValue HKCU "Software\Classes\.dicom" "Content Type"
  DeleteRegValue HKCU "Software\Classes\.dicom" "PerceivedType"
  DeleteRegValue HKCU "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dicom\OpenWithProgids"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dicom"

  DeleteRegValue HKLM "Software\Classes\.dcm" ""
  DeleteRegValue HKLM "Software\Classes\.dcm" "Content Type"
  DeleteRegValue HKLM "Software\Classes\.dcm" "PerceivedType"
  DeleteRegValue HKLM "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKLM "Software\Classes\.dcm\OpenWithProgids"
  DeleteRegKey /ifempty HKLM "Software\Classes\.dcm"

  DeleteRegValue HKLM "Software\Classes\.dicom" ""
  DeleteRegValue HKLM "Software\Classes\.dicom" "Content Type"
  DeleteRegValue HKLM "Software\Classes\.dicom" "PerceivedType"
  DeleteRegValue HKLM "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKLM "Software\Classes\.dicom\OpenWithProgids"
  DeleteRegKey /ifempty HKLM "Software\Classes\.dicom"

  DeleteRegKey HKCU "Software\Classes\DicomVision.DICOM"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
