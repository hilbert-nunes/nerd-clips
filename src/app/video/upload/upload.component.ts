import { Router } from '@angular/router';
import { ClipService } from './../../services/clip.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from '@angular/fire/compat/storage';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { last, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import firebase from 'firebase/compat/app';
import { ModalService } from 'src/app/services/modal.service';
import { setInterval } from 'timers';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css'],
})
export class UploadComponent implements OnDestroy, OnInit {

  // colors
  red = 'rgb(248 113 113)'
  green = 'rgb(74 222 128)'
  blue = 'rgb(34 211 238)'

  // deny button while submitting
  inSubmission = false

  // --- alert properties ---
  showAlert = false
  alertMsg = 'Please wait! Your account is being created'
  alertColor = this.blue
  // --- alert properties ---

  // upload settings
  isDragover = false;
  file: File | null = null;
  nextStep = false;
  percentage = 0;
  showPercentage = false;
  // upload settings

  user: firebase.User | null = null;
  task?: AngularFireUploadTask;

  title = new FormControl('', {
    validators: [Validators.required, Validators.minLength(3)],
    nonNullable: true,
  });

  uploadForm = new FormGroup({
    title: this.title,
  });

  constructor(
    private storage: AngularFireStorage,
    private auth: AngularFireAuth,
    private clipsService: ClipService,
    private router: Router,
  ) {
    auth.user.subscribe((user) => (this.user = user));
  }
  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.task?.cancel();
  }

  storeFile($event: Event) {
    this.isDragover = false;

    this.file = ($event as DragEvent).dataTransfer
      ? ($event as DragEvent).dataTransfer?.files.item(0) ?? null
      : ($event.target as HTMLInputElement).files?.item(0) ?? null;

    if (!this.file || this.file.type !== 'video/mp4') {
      return;
    }

    this.title.setValue(this.file.name.replace(/\.[^/.]+$/, ''));
    this.nextStep = true;
  }

  uploadFile() {
    this.uploadForm.disable();
    this.showAlert = true;
    this.alertColor = this.blue;
    this.alertMsg = 'Please wait! Your clip is being uploaded.';
    this.inSubmission = true;
    this.showPercentage = true;

    const clipFileName = uuid();
    const clipPath = `clips/${clipFileName}.mp4`;

    try {
      this.task = this.storage.upload(clipPath, this.file);
      const clipRef = this.storage.ref(clipPath);

      this.task.percentageChanges().subscribe((progress) => {
        this.percentage = (progress as number) / 100;
      });

      this.task
        .snapshotChanges()
        .pipe(
          last(),
          switchMap(() => clipRef.getDownloadURL())
        )
        .subscribe({
          next: async (url) => {
            const clip = {
              uid: this.user?.uid as string,
              displayName: this.user?.displayName as string,
              title: this.title.value,
              fileName: `${clipFileName}.mp4`,
              url,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            };

            const clipDocRef = await this.clipsService.createClip(clip);

            console.log(clip);

            this.alertColor = this.green;
            this.alertMsg = 'Success! Your clip has been uploaded.';
            this.showPercentage = false;

            setTimeout(() => {
              this.router.navigate([
                'clip', clipDocRef.id
              ]);
            }, 1000);
          },
          error: (error) => {
            this.uploadForm.enable();
            this.alertColor = this.red;
            this.alertMsg = 'Error! Your clip could not be uploaded.';
            this.inSubmission = true;
            this.showPercentage = false;
            console.log(error);
          },
        });
    } catch (error) {
      console.log(error);
    }
  }
}
