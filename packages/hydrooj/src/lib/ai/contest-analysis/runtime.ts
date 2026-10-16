import system from '../../../model/system';
import type { PublicAiModelProfile } from '../config';
import { getSelectedAiModelProfileId } from '../config';
import type { AiModelRuntimeConfig } from '../runtime';
import {
    getAiModelRuntimeConfig, getConfiguredAiModelProfiles, getConfiguredAiProviderConfig,
} from '../runtime';
import { validateAiModelRuntimeConfig } from '../validation';

export function isContestAnalysisEnabled() {
    const explicit = system.get('contestAnalysis.enabled');
    if (explicit === undefined || explicit === null) return !!system.get('aiGeneration.enabled');
    return !!explicit;
}

export function getDefaultContestAnalysisProfileId() {
    const config = getConfiguredAiProviderConfig();
    return getSelectedAiModelProfileId(config?.contestAnalysis, config);
}

export function getContestAnalysisConfig(profileId?: string): AiModelRuntimeConfig {
    const selectedId = profileId || getDefaultContestAnalysisProfileId();
    return {
        ...getAiModelRuntimeConfig(selectedId),
        enabled: isContestAnalysisEnabled(),
    };
}

export function validateContestAnalysisConfig(config: AiModelRuntimeConfig) {
    validateAiModelRuntimeConfig(config, 'AI contest analysis is disabled.');
}

export function getPublicContestAnalysisProfiles(): PublicAiModelProfile[] {
    return getConfiguredAiModelProfiles().flatMap((profile) => {
        try {
            validateContestAnalysisConfig({ ...getContestAnalysisConfig(profile.id), enabled: true });
            return [{ id: profile.id, label: profile.label, model: profile.model }];
        } catch {
            return [];
        }
    });
}
