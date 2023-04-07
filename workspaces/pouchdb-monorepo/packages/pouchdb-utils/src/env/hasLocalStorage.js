export default () => 
localStorage?.setItem('_pouch_check_localstorage', 1) || localStorage?.getItem('_pouch_check_localstorage');
