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

!macro customInstall
  SetRegView 64

  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "" "DicomVision DICOM Preview Handler"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "AppID" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegDWORD HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DisableLowILProcessIsolation" 1
  WriteRegDWORD HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DisableProcessIsolation" 0
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "" "mscoree.dll"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "ThreadingModel" "Apartment"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "Class" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "Assembly" "DicomVisionShellExtension, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "RuntimeVersion" "v4.0.30319"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "CodeBase" "file:///$INSTDIR/resources/shell/DicomVisionShellExtension.dll"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "Class" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "Assembly" "DicomVisionShellExtension, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "RuntimeVersion" "v4.0.30319"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "CodeBase" "file:///$INSTDIR/resources/shell/DicomVisionShellExtension.dll"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\ProgId" "" "DicomVision.DicomShellHandler"
  WriteRegStr HKCU "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "" "DicomVision DICOM Preview Handler"
  WriteRegStr HKCU "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DllSurrogate" "Prevhost.exe"
  WriteRegStr HKCU "Software\Classes\DicomVision.DicomShellHandler" "" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKCU "Software\Classes\DicomVision.DicomShellHandler\CLSID" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\Implemented Categories\{62C8FE65-4EBB-45E7-B440-6E39B2CDBF29}" "" ""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DicomVision DICOM Preview Handler"

  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "AppID" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegDWORD HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DisableLowILProcessIsolation" 1
  WriteRegDWORD HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DisableProcessIsolation" 0
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "" "mscoree.dll"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "ThreadingModel" "Apartment"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "Class" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "Assembly" "DicomVisionShellExtension, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "RuntimeVersion" "v4.0.30319"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32" "CodeBase" "file:///$INSTDIR/resources/shell/DicomVisionShellExtension.dll"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "Class" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "Assembly" "DicomVisionShellExtension, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "RuntimeVersion" "v4.0.30319"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\InprocServer32\1.0.0.0" "CodeBase" "file:///$INSTDIR/resources/shell/DicomVisionShellExtension.dll"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\ProgId" "" "DicomVision.DicomShellHandler"
  WriteRegStr HKLM "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "" "DicomVision DICOM Preview Handler"
  WriteRegStr HKLM "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DllSurrogate" "Prevhost.exe"
  WriteRegStr HKLM "Software\Classes\DicomVision.DicomShellHandler" "" "DicomVision.ShellExtension.DicomShellHandler"
  WriteRegStr HKLM "Software\Classes\DicomVision.DicomShellHandler\CLSID" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}\Implemented Categories\{62C8FE65-4EBB-45E7-B440-6E39B2CDBF29}" "" ""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}" "DicomVision DICOM Preview Handler"

  WriteRegStr HKCU "Software\Classes\.dcm" "" "DicomVision.DICOM"
  WriteRegStr HKCU "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM" ""
  WriteRegStr HKCU "Software\Classes\.dcm\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKCU "Software\Classes\.dcm\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKCU "Software\Classes\.dicom" "" "DicomVision.DICOM"
  WriteRegStr HKCU "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM" ""
  WriteRegStr HKCU "Software\Classes\.dicom\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKCU "Software\Classes\.dicom\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"

  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM" "" "DICOM medical image"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM" "FriendlyTypeName" "DICOM medical image"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\DefaultIcon" "" '"$INSTDIR\DicomVision.exe",0'
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell\open" "" "Open with DicomVision"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\shell\open\command" "" '"$INSTDIR\DicomVision.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  WriteRegStr HKCU "Software\Classes\DicomVision.DICOM\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}" "" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  SetRegView 64

  DeleteRegKey HKCU "Software\Classes\.dcm\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey HKCU "Software\Classes\.dcm\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegValue HKCU "Software\Classes\.dcm" ""
  DeleteRegValue HKCU "Software\Classes\.dcm\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dcm\OpenWithProgids"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dcm\ShellEx"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dcm"

  DeleteRegKey HKCU "Software\Classes\.dicom\ShellEx\{8895b1c6-b41f-4c1c-a562-0d564250836f}"
  DeleteRegKey HKCU "Software\Classes\.dicom\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}"
  DeleteRegValue HKCU "Software\Classes\.dicom" ""
  DeleteRegValue HKCU "Software\Classes\.dicom\OpenWithProgids" "DicomVision.DICOM"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dicom\OpenWithProgids"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dicom\ShellEx"
  DeleteRegKey /ifempty HKCU "Software\Classes\.dicom"

  DeleteRegKey HKCU "Software\Classes\DicomVision.DICOM"
  DeleteRegKey HKCU "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey HKCU "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey HKCU "Software\Classes\DicomVision.DicomShellHandler"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey HKLM "Software\Classes\CLSID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey HKLM "Software\Classes\AppID\{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"
  DeleteRegKey HKLM "Software\Classes\DicomVision.DicomShellHandler"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "{6F5351BB-0C26-45B5-94C5-B5C90FAE55DC}"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
