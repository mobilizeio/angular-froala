angular.module('froala', []).
value('froalaConfig', {})
.directive('froala', ['froalaConfig', function (froalaConfig) {
    "use strict"; //Scope strict mode to only this directive
    var generatedIds = 0;
    var defaultConfig = { immediateAngularModelUpdate: false};

    var scope = {
        froalaOptions: '=froala',
        initFunction: '&froalaInit'
    };

    froalaConfig = froalaConfig || {};

    // Constants
    var MANUAL = "manual";
    var AUTOMATIC = "automatic";

    return {
        restrict: 'A',
        require: 'ngModel',
        scope: scope,
        link: function (scope, element, attrs, ngModel) {

            var ctrl = {
                editorInitialized: false,
                editorRegistered: false
            };

            scope.initMode = attrs.froalaInit ? MANUAL : AUTOMATIC;

            ctrl.init = function () {
                if (!attrs.id) {
                    // generate an ID if not present
                    attrs.$set('id', 'froala-' + generatedIds++);
                }

                //init the editor
                if (scope.initMode === AUTOMATIC) {
                    ctrl.editorInitialized = true;
                    ctrl.createEditor();
                }

                //Instruct ngModel how to update the froala editor
                ngModel.$render = function () {
                    if(ctrl.editorInitialized){
                        element.froalaEditor('html.set', ngModel.$viewValue || '', true);
                        //This will reset the undo stack everytime the model changes externally. Can we fix this?
                        element.froalaEditor('undo.reset');
                        element.froalaEditor('undo.saveStep');
                    }

                };

                ngModel.$isEmpty = function (value) {
                  var isEmpty = !ctrl.editorInitialized ? true : element.froalaEditor('node.isEmpty', jQuery('<div>' + value + '</div>').get(0));
                  return value === undefined || value === null || isEmpty;
                };

                //For DOM -> model validation
                ngModel.$parsers.unshift(function (value) {
                    var valid = true;
                    if(scope.froalaOptions.required){
                        valid = !element.froalaEditor('core.isEmpty');
                        ngModel.$setValidity('required_err', valid);
                    }
                    return valid ? value : undefined;
                });

                //For model -> DOM validation
                ngModel.$formatters.unshift(function (value) {
                    updateRequireValidator();
                    return value;
                });

            };

            ctrl.createEditor = function () {
                ctrl.listeningEvents = ['froalaEditor'];
                if (!ctrl.editorRegistered) {
                    ctrl.options = angular.extend({}, defaultConfig, froalaConfig, scope.froalaOptions);

                    if (ctrl.options.immediateAngularModelUpdate) {
                        ctrl.listeningEvents.push('keyup');
                    }

                    if(ctrl.options.events){
                        ctrl.bindInitializeEvent();
                    }

                    // Register events provided in the options
                    // Registering events before initializing the editor will bind the initialized event correctly.
                    for (var eventName in ctrl.options.events) {
                        if (ctrl.options.events.hasOwnProperty(eventName)) {
                            ctrl.registerEventsWithCallbacks(eventName, ctrl.options.events[eventName]);
                        }
                    }

                    ctrl.froalaElement = element.froalaEditor(ctrl.options).data('froala.editor').$el;
                    ctrl.froalaEditor = angular.bind(element, element.froalaEditor);
                    ctrl.initListeners();

                    //assign the froala instance to the options object to make methods available in parent scope
                    if (scope.froalaOptions) {
                        scope.froalaOptions.froalaEditor = ctrl.froalaEditor;
                    }

                    ctrl.editorRegistered = ctrl.froalaEditor ? true : false;
                }
            };

            ctrl.bindInitializeEvent = function() {
                var originalInitializeCall = ctrl.options.events['froalaEditor.initialized'];

                function init() {
                    ctrl.editorInitialized = true;
                    ngModel.$render();
                    updateRequireValidator();

                    if (originalInitializeCall && originalInitializeCall.toString() !== init.toString()) {
                        originalInitializeCall.call();
                    }
                }

                ctrl.options.events['froalaEditor.initialized'] = init;
            }

            ctrl.initListeners = function () {
                if (ctrl.options.immediateAngularModelUpdate) {
                    ctrl.froalaElement.on('keyup', function () {
                        scope.$evalAsync(ctrl.updateModelView);
                    });
                }

                ctrl.froalaElement.on('$destroy', function(){
                    ctrl.froalaElement.off('$destroy');
                    destroyOnce();
                });

                element.on('froalaEditor.contentChanged', function () {
                    scope.$evalAsync(ctrl.updateModelView);
                });

                if(!ctrl.editorInitialized){
                    element.on('froalaEditor.initialized', function () {
                        element.off('froalaEditor.initialized');
                        ctrl.editorInitialized = ctrl.froalaEditor ? true : false;
                        ngModel.$render();
                    });

                }

                scope.$on('$destroy', function () {
                    ctrl.listeningEvents.push('froalaEditor.contentChanged');
                    element.off(ctrl.listeningEvents.join(" "));
                    destroyOnce();
                });
            };

            ctrl.updateModelView = function () {
                var returnedHtml = element.froalaEditor('html.get');
                if (angular.isString(returnedHtml)) {
                    if(/[\u0590-\u05FF]/.test(returnedHtml)){
                       returnedHtml = "<div dir='rtl'>"+returnedHtml+"</div>";
                    }
                    ngModel.$setViewValue(returnedHtml);
                }
            };

            ctrl.registerEventsWithCallbacks = function (eventName, callback) {
                if (eventName && callback) {
                    ctrl.listeningEvents.push(eventName);
                    element.on(eventName, callback);
                }
            };

            if (scope.initMode === MANUAL) {
                var _ctrl = ctrl;
                var controls = {
                    initialize: ctrl.createEditor,
                    destroy: function () {
                        if (_ctrl.froalaEditor) {
                            destroyOnce();
                        }
                    },
                    getEditor: function () {
                        return _ctrl.froalaEditor ? _ctrl.froalaEditor : null;
                    }
                };
                scope.initFunction({initControls: controls});
            }
            ctrl.init();

            function destroyOnce(){
                if(ctrl.editorInitialized){
                        ctrl.froalaEditor('destroy');
                    }

                    ctrl.editorInitialized = false;
            }

            function updateRequireValidator(){
                var valid = true;
                if(scope.froalaOptions.required){
                    valid = !element.froalaEditor('core.isEmpty');
                }
                ngModel.$setValidity('required_err', valid);
            }
        }
    };
}])
.directive('froalaView', ['$sce', function ($sce) {
    return {
        restrict: 'ACM',
        scope: false,
        link: function (scope, element, attrs) {
            element.addClass('fr-view');
            scope.$watch(attrs.froalaView, function (nv) {
                if (nv || nv === ''){
                    var explicitlyTrustedValue = $sce.trustAsHtml(nv);
                    element.html(explicitlyTrustedValue.toString());
                }
            });
        }
    };
}]);
