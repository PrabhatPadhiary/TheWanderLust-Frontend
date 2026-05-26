import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private _visible = new BehaviorSubject<boolean>(false);
  private _message = new BehaviorSubject<string>('Loading...');

  visible$ = this._visible.asObservable();
  message$ = this._message.asObservable();

  show(message = 'Loading...'): void {
    this._message.next(message);
    this._visible.next(true);
  }

  hide(): void {
    this._visible.next(false);
  }
}
