import type {BackgroundController} from './useBackground';
export default function BackgroundLayer({background}:{background:BackgroundController}) {
  if(!background.active)return null;
  return <div className="app-background" data-background-layer aria-hidden="true">
    <img key={background.imageKey} src={background.url} alt="" onError={()=>background.imageFailed(background.imageKey)}/>
    <div className="background-shade" style={{opacity:background.shade/100}}/>
  </div>;
}
