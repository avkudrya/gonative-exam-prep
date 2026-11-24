export type Theme = 'light' | 'dark' | 'system';
export const themeKey = 'exams-theme';
/** Runs before first paint, so a dark theme never flashes light. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${themeKey}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
