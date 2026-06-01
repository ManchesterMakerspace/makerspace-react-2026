import moment from 'moment-timezone';
import tzData from './newYorkTimezoneData.json';

moment.tz.load({
  version: tzData.version,
  zones: tzData.zones,
  links: tzData.links,
});

export default moment;
