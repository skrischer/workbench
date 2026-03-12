// Type declaration for marked-terminal
declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';

  interface MarkedTerminalOptions {
    reflowText?: boolean;
    width?: number;
    showSectionPrefix?: boolean;
    tab?: number;
  }

  function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;

  export default markedTerminal;
}
