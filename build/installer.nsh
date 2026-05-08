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
