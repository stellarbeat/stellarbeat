import valueValidator from 'validator';
import { isString } from '../../../../core/utilities/TypeGuards';
import * as semver from 'semver/preload';

export class TomlVersionChecker {
	static isSupportedVersion(
		tomlObject: Record<string, unknown>,
		lowestSupportedVersion = '2.0.0'
	): boolean {
		if (!valueValidator.isSemVer(lowestSupportedVersion)) return false;
		if (!isString(tomlObject.VERSION)) return false;
		if (!valueValidator.isSemVer(tomlObject.VERSION)) return false;

		return !semver.lt(tomlObject.VERSION, lowestSupportedVersion);
	}
}
