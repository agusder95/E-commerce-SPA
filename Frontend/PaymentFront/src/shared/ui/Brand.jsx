import { BRAND_LOGO, BRAND_NAME } from '../brand.js';
import './brand.css';

export default function Brand() {
  return <><img className="brand-logo" src={BRAND_LOGO} alt="" width="42" height="56" />
    <span className="brand-name">{BRAND_NAME}</span></>;
}
