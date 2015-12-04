//=============================================================================
// OtonohaTouch.js
//=============================================================================

/*:
 * @plugindesc オトノハのプレイ画面をタッチ操作に対応させる
 * @author 042
 *
 * @help
 * プレイ画面ではタッチ操作によるマップ移動が無効になる
 * クリックしたマスが点滅してしまうのでその対策
 *
 * @param Number of Buttons
 * @default 5
 *
 * @param Offset X
 * @default 48
 *
 * @param Offset Y
 * @default 438
 *
 * @param Button Width
 * @default 80
 *
 * @param Button Height
 * @default 85
 *
 * @param Button Margin
 * @default 0
 *
 * @param Play Map ID
 * @default 2
 *
 * @param Input Enabled SW
 * @default 322
 */

(function() {

    var parameters = PluginManager.parameters('OtonohaTouch'),
        OTONOHA = {
            btn: {},
            isPlayMap: function() {
                return $gameMap && $gameMap._mapId === Number(parameters['Play Map ID'] || 2);
            },
            isPlay: function() {
                return this.isPlayMap() && $gameSwitches.value(Number(parameters['Input Enabled SW'] || 322));
            },
            updateTouch: function(x, y, t) {
                if (!this.isPlay() || !this.btn.isY(y)) return;
                for (var i = 0; i < this.btn.num(); i++) {
                    if (this.btn.isX(x, i)) this.btn.setTouch(i, t);
                }
            },
            updateFlick: function(x, y) {
                if (!this.isPlay()) return;
                for (var i = 0; i < this.btn.num(); i++) {
                    this.flick(x, y, i);
                }
            },
            flick: function(x, y, i) {
                if (this.btn.touched(i)) {
                    if (!this.btn.isY(y) || !this.btn.isX(x, i)) this.btn.setTouch(i, false);
                }
            }
        };

    OTONOHA.btn = (function(){
        var num = Number(parameters['Number of Buttons'] || 5),
            ox = Number(parameters['Offset X'] || 48),
            oy = Number(parameters['Offset Y'] || 438),
            width = Number(parameters['Button Width'] || 80),
            height = Number(parameters['Button Height'] || 85),
            margin = Number(parameters['Button Margin'] || 0),
            touched = [],
            left = [],
            bottom = oy + height,
            right = [];

        for (var i = 0; i < num; i++) {
            touched[i] = false;
            left[i] = ox + width * i + margin * i;
            right[i] = left[i] + width;
        }

        return {
            num: function() {
                return num;
            },
            touched: function(i) {
                return touched[i];
            },
            setTouch: function(i, t) {
                touched[i] = t;
            },
            isY: function(y) {
                return y > oy && y <= bottom;
            },
            isX: function(x, i) {
                return x > left[i] && x <= right[i];
            }
        }
    })();

    var _TouchInput_update = TouchInput.update;
    TouchInput.update = function() {
        _TouchInput_update.call(this);
        OTONOHA.updateFlick(this.x, this.y);
    };

    var _TouchInput_onLeftButtonDown = TouchInput._onLeftButtonDown;
    TouchInput._onLeftButtonDown = function(event) {
        if (OTONOHA.isPlayMap()) {
            var x = Graphics.pageToCanvasX(event.pageX);
            var y = Graphics.pageToCanvasY(event.pageY);
            if (Graphics.isInsideCanvas(x, y)) {
                // this._mousetouched = true;
                this._touchedTime = 0;
                this._onTrigger(x, y);
            }

            OTONOHA.updateTouch(x, y, true);
        } else {
            _TouchInput_onLeftButtonDown.call(this, event);
        }
    };

    var _TouchInput_onRelease = TouchInput._onRelease;
    TouchInput._onRelease = function(x, y) {
        _TouchInput_onRelease.call(this, x, y);
        OTONOHA.updateTouch(x, y, false);
    };

    Game_Interpreter.prototype.isTouched = function(i) {
        return OTONOHA.btn.touched(i);
    };

})();