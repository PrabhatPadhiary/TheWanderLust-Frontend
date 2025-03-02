import { FormGroup, FormControl } from "@angular/forms";
import { AbstractControl, ValidationErrors } from "@angular/forms";

export default class ValidateForm {
  static validateAllFormFields(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof FormControl) {
        control.markAsDirty({ onlySelf: true });
      }
      else if (control instanceof FormGroup) {
        this.validateAllFormFields(control);
      }
    })
  }

  static noSpaceValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value || '';
    return value.includes(' ') ? { noSpace: true } : null;
  }
}
