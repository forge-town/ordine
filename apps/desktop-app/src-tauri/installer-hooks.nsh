; Never let Tauri's silent installer terminate running task owners by executable name.
; The user must close Ordine normally so its native shutdown can converge active Jobs.
!macro RequireOrdineStopped
  nsis_tauri_utils::FindProcessCurrentUser "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 = 0
    SetErrorLevel 2
    IfSilent +2 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "Close Ordine normally before installing or uninstalling. Running tasks will not be force-terminated by this installer."
    Abort "Ordine is running; close it and retry."
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro RequireOrdineStopped
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro RequireOrdineStopped
!macroend
